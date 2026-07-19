#!/usr/bin/env python3
"""Convert PNG assets to lossless WebP without deleting a source before validation."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # Keep the failure actionable when Pillow is not installed.
    Image = None

REPO_ROOT = Path(__file__).resolve().parents[1]


def valid_webp(path: Path, expected_size: tuple[int, int]) -> bool:
    try:
        with Image.open(path) as image:
            image.load()
            return image.format == "WEBP" and image.size == expected_size
    except (OSError, ValueError):
        return False


def convert(source: Path) -> str:
    destination = source.with_suffix(".webp")
    temporary = destination.with_name(f"{destination.name}.part")

    try:
        with Image.open(source) as original:
            original.load()
            dimensions = original.size
            has_alpha = "A" in original.getbands() or "transparency" in original.info
            converted = (
                original
                if original.mode in {"RGB", "RGBA"}
                else original.convert("RGBA" if has_alpha else "RGB")
            )

            try:
                if valid_webp(destination, dimensions):
                    source.unlink()
                    return "deduplicated"
                converted.save(temporary, format="WEBP", lossless=True, method=6)
            finally:
                if converted is not original:
                    converted.close()

        if not valid_webp(temporary, dimensions):
            raise ValueError("encoded file is not a valid WebP with matching dimensions")
        temporary.replace(destination)
        source.unlink()
        return "converted"
    finally:
        temporary.unlink(missing_ok=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "directory",
        nargs="?",
        type=Path,
        default=REPO_ROOT / "assets" / "items",
        help="Directory containing PNG files (default: assets/items).",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Also convert PNG files in nested directories.",
    )
    return parser.parse_args()


def main() -> int:
    if Image is None:
        print("Pillow is required: python -m pip install Pillow", file=sys.stderr)
        return 2

    args = parse_args()
    if not args.directory.is_dir():
        print(f"Directory does not exist: {args.directory}", file=sys.stderr)
        return 2

    sources = (
        args.directory.rglob("*.png")
        if args.recursive
        else args.directory.glob("*.png")
    )
    png_files = sorted(sources, key=lambda path: path.as_posix())
    converted = 0
    deduplicated = 0
    failures = []

    for source in png_files:
        try:
            result = convert(source)
        except (OSError, ValueError) as error:
            failures.append(f"{source}: {error}")
            continue

        if result == "converted":
            converted += 1
        else:
            deduplicated += 1

    print(
        f"{converted} converted, {deduplicated} existing WebP files reused, "
        f"{len(failures)} failed"
    )
    for failure in failures:
        print(failure, file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
