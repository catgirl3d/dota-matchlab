import json
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

def main():
    # 1. Fetch ability_ids.json from dotaconstants
    url = "https://raw.githubusercontent.com/odota/dotaconstants/master/build/ability_ids.json"
    print("Fetching ability IDs from dotaconstants...")
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "dota-matchlab-ability-sync/1.0"}
    )
    with urllib.request.urlopen(req) as response:
        ability_ids = json.loads(response.read().decode())

    # ability_ids structure is "1679": "spectre_shadow_step"
    # Let's invert it: slug -> int ID
    slug_to_id = {}
    for aid, slug in ability_ids.items():
        try:
            slug_to_id[slug] = int(aid)
        except ValueError:
            continue

    # 2. Scan assets/abilities/*.webp
    abilities_dir = REPO_ROOT / "assets" / "abilities"
    webp_files = sorted(abilities_dir.glob("*.webp"))
    slugs = [p.stem for p in webp_files]

    # 3. Match and map slug -> ID
    mapped = {}
    missing = []
    for slug in slugs:
        if slug in slug_to_id:
            mapped[slug_to_id[slug]] = slug
        else:
            missing.append(slug)

    print(f"Mapped {len(mapped)} abilities. Mapping missing for {len(missing)} slugs.")
    if missing:
        print(f"Missing slugs: {missing[:10]}...")

    # 4. Generate TS file src/react-app/lib/ability-icon-slugs.ts
    ts_content = "export const abilityIconSlugs: Record<number, string> = {\n"
    sorted_mapped = sorted(mapped.items())
    for aid, slug in sorted_mapped:
        ts_content += f"  {aid}: '{slug}',\n"
    ts_content += "};\n"

    output_file = REPO_ROOT / "src" / "react-app" / "lib" / "ability-icon-slugs.ts"
    output_file.write_text(ts_content, encoding="utf-8")
    print(f"Wrote to {output_file}")

if __name__ == "__main__":
    main()
