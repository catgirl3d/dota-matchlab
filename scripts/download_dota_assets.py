#!/usr/bin/env python3
"""Download Dota ability and item icons from the documented public sources."""

from __future__ import annotations

import argparse
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_URLS = {
    "abilities": "https://raw.githubusercontent.com/odota/dotaconstants/master/build/abilities.json",
    "items": "https://raw.githubusercontent.com/odota/dotaconstants/master/build/items.json",
}
STRATZ_BASE_URLS = {
    "abilities": "https://cdn.stratz.com/images/dota2/abilities",
    "items": "https://cdn.stratz.com/images/dota2/items",
}
DOTABUFF_ITEMS_URL = "https://www.dotabuff.com/assets/items"
VALVE_CDN_URL = "https://cdn.cloudflare.steamstatic.com"
USER_AGENT = "dota-matchlab-asset-sync/1.0"
SAFE_SLUG = re.compile(r"^[a-z0-9_]+$")
SAFE_ITEM_FILENAME = re.compile(r"^[a-z0-9_]+\.png$")

CONTENT_TYPE_EXTENSIONS = {
    "image/png": ".png",
    "image/webp": ".webp",
    "image/jpeg": ".jpg",
}
KNOWN_EXTENSIONS = tuple(CONTENT_TYPE_EXTENSIONS.values())


@dataclass(frozen=True)
class Source:
    label: str
    url: str


@dataclass(frozen=True)
class Asset:
    key: str
    stem: str
    sources: tuple[Source, ...]


@dataclass(frozen=True)
class DownloadResult:
    key: str
    status: str
    error: str | None = None


def fetch(url: str) -> tuple[str, bytes]:
    request = Request(
        url,
        headers={
            "Accept": "image/avif,image/webp,image/png,image/*;q=0.8,*/*;q=0.5",
            "User-Agent": USER_AGENT,
        },
    )
    with urlopen(request, timeout=30) as response:
        return response.headers.get_content_type(), response.read()


def is_image_bytes(extension: str, content: bytes) -> bool:
    if extension == ".png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".webp":
        return content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    if extension == ".jpg":
        return content.startswith(b"\xff\xd8\xff")
    return False


def image_extension(content_type: str, content: bytes) -> str | None:
    extension = CONTENT_TYPE_EXTENSIONS.get(content_type)
    if extension and is_image_bytes(extension, content):
        return extension

    for candidate in KNOWN_EXTENSIONS:
        if is_image_bytes(candidate, content):
            return candidate
    return None


def has_image_signature(path: Path, extension: str) -> bool:
    try:
        with path.open("rb") as image_file:
            return is_image_bytes(extension, image_file.read(12))
    except OSError:
        return False


def load_manifest(kind: str) -> dict[str, Any]:
    _, content = fetch(MANIFEST_URLS[kind])
    manifest = json.loads(content)
    if not isinstance(manifest, dict):
        raise ValueError(f"{kind} manifest is not a JSON object")
    return manifest


def item_image(entry: Any) -> tuple[str, str] | None:
    if not isinstance(entry, dict):
        return None

    image_path = entry.get("img")
    if not isinstance(image_path, str):
        return None

    path_without_query = image_path.split("?", 1)[0]
    marker = "/items/"
    if marker not in path_without_query:
        return None

    filename = path_without_query.rsplit(marker, 1)[1]
    if not SAFE_ITEM_FILENAME.fullmatch(filename):
        return None
    return filename, image_path


def ability_assets(manifest: dict[str, Any]) -> list[Asset]:
    assets = []
    base_url = STRATZ_BASE_URLS["abilities"]

    for slug, entry in manifest.items():
        if not SAFE_SLUG.fullmatch(slug) or not isinstance(entry, dict):
            continue
        image_path = entry.get("img")
        if image_path != f"/apps/dota2/images/dota_react/abilities/{slug}.png":
            continue

        assets.append(
            Asset(
                key=slug,
                stem=slug,
                sources=(
                    Source("STRATZ", f"{base_url}/{quote(slug, safe='')}.png"),
                ),
            )
        )

    return sorted(assets, key=lambda asset: asset.key)


def item_assets(manifest: dict[str, Any]) -> list[Asset]:
    assets_by_filename: dict[str, Asset] = {}
    stratz_base_url = STRATZ_BASE_URLS["items"]

    for entry in manifest.values():
        parsed_image = item_image(entry)
        if parsed_image is None:
            continue

        filename, valve_path = parsed_image
        if filename in assets_by_filename:
            continue

        stem = filename.removesuffix(".png")
        # STRATZ is preferred; Valve is the source advertised by the manifest.
        assets_by_filename[filename] = Asset(
            key=filename,
            stem=stem,
            sources=(
                Source("STRATZ", f"{stratz_base_url}/{quote(filename, safe='')}"),
                Source("Dotabuff", f"{DOTABUFF_ITEMS_URL}/{quote(stem, safe='')}.jpg"),
                Source("Valve", f"{VALVE_CDN_URL}{valve_path}"),
            ),
        )

    return sorted(assets_by_filename.values(), key=lambda asset: asset.key)


def existing_asset(output_dir: Path, stem: str) -> Path | None:
    for extension in KNOWN_EXTENSIONS:
        candidate = output_dir / f"{stem}{extension}"
        if candidate.is_file() and has_image_signature(candidate, extension):
            return candidate
    return None


def save_asset(output_dir: Path, stem: str, extension: str, content: bytes) -> None:
    destination = output_dir / f"{stem}{extension}"
    temporary = destination.with_name(f"{destination.name}.part")

    try:
        temporary.write_bytes(content)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)

    for alternate_extension in KNOWN_EXTENSIONS:
        alternate = output_dir / f"{stem}{alternate_extension}"
        if alternate != destination:
            alternate.unlink(missing_ok=True)


def download_asset(asset: Asset, output_dir: Path, force: bool) -> DownloadResult:
    if not force and existing_asset(output_dir, asset.stem) is not None:
        return DownloadResult(asset.key, "skipped")

    errors = []
    for source in asset.sources:
        try:
            content_type, content = fetch(source.url)
        except HTTPError as error:
            errors.append(f"{source.label}: HTTP {error.code}")
            continue
        except (URLError, OSError, TimeoutError) as error:
            errors.append(f"{source.label}: {error}")
            continue

        extension = image_extension(content_type, content)
        if extension is None:
            errors.append(f"{source.label}: unsupported response type {content_type}")
            continue

        try:
            save_asset(output_dir, asset.stem, extension, content)
        except OSError as error:
            return DownloadResult(asset.key, "failed", str(error))
        return DownloadResult(asset.key, "downloaded")

    return DownloadResult(asset.key, "failed", "; ".join(errors))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=("abilities", "items"))
    parser.add_argument(
        "--output",
        type=Path,
        help="Destination directory (default: assets/<kind> from the repository root).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=6,
        help="Maximum concurrent requests (default: 6).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download already valid local images.",
    )
    args = parser.parse_args()
    if args.workers < 1:
        parser.error("--workers must be at least 1")
    return args


def main() -> int:
    args = parse_args()
    output_dir = args.output or REPO_ROOT / "assets" / args.kind
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        manifest = load_manifest(args.kind)
        assets = ability_assets(manifest) if args.kind == "abilities" else item_assets(manifest)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Could not load {args.kind} manifest: {error}", file=sys.stderr)
        return 2

    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [
            executor.submit(download_asset, asset, output_dir, args.force)
            for asset in assets
        ]
        for future in as_completed(futures):
            results.append(future.result())

    failures = sorted(
        f"{result.key}: {result.error}"
        for result in results
        if result.status == "failed"
    )
    (output_dir / "failed.txt").write_text(
        "\n".join(failures) + ("\n" if failures else ""),
        encoding="utf-8",
    )

    downloaded = sum(result.status == "downloaded" for result in results)
    skipped = sum(result.status == "skipped" for result in results)
    print(
        f"{args.kind}: {downloaded} downloaded, {skipped} already present, "
        f"{len(failures)} unresolved"
    )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
