# Dota asset sources

Reusable download and conversion tools live in [`scripts/`](scripts/). The CDN directories do not expose file listings; always obtain names from a manifest first.

## Commands

```bash
# Python standard library only.
python scripts/download_dota_assets.py abilities
python scripts/download_dota_assets.py items

# Requires Pillow; defaults to assets/items.
python -m pip install Pillow
python scripts/convert_png_to_webp.py
```

Use `--force` to refresh existing images, `--output <directory>` to change a download destination, and `--recursive` when converting PNG files in nested directories.

## Name manifests

| Asset type | Manifest | Naming rule |
| --- | --- | --- |
| Abilities | [OpenDota abilities.json](https://raw.githubusercontent.com/odota/dotaconstants/master/build/abilities.json) | JSON key, for example `necrolyte_death_pulse` |
| Items | [OpenDota items.json](https://raw.githubusercontent.com/odota/dotaconstants/master/build/items.json) | Filename from the entry's `img` field; do not use the JSON key for recipes |

## CDN URLs and fallback order

### Ability icons

1. [STRATZ abilities CDN](https://cdn.stratz.com/images/dota2/abilities/)
   - Template: `https://cdn.stratz.com/images/dota2/abilities/<ability-slug>.png`
   - Example: [`necrolyte_death_pulse.png`](https://cdn.stratz.com/images/dota2/abilities/necrolyte_death_pulse.png)
2. [Valve static Dota CDN](https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/)
   - Template: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/<ability-slug>.png`
   - Example: [`abaddon_withering_mist.png`](https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/abaddon_withering_mist.png)

Valve is the fallback for manifest entries that STRATZ does not mirror. It may serve WebP content for a `.png` URL; the downloader preserves the response's verified format.

### Item icons

The downloader tries these public sources in order and writes the actual response format (`.webp`, `.png`, or `.jpg`):

1. [STRATZ items CDN](https://cdn.stratz.com/images/dota2/items/)
   - Template: `https://cdn.stratz.com/images/dota2/items/<item-file>.png`
   - Example: [`radiance.png`](https://cdn.stratz.com/images/dota2/items/radiance.png)
2. [Dotabuff item assets](https://www.dotabuff.com/assets/items/)
   - Template: `https://www.dotabuff.com/assets/items/<item-file-stem>.jpg`
   - Example: [`harmonizer.jpg`](https://www.dotabuff.com/assets/items/harmonizer.jpg)
3. [Valve static Dota CDN](https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/)
   - Use the full relative path from `items.json`'s `img` field.
   - Example: [`conjurers_catalyst.png`](https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/conjurers_catalyst.png)

Valve is the complete fallback for current manifest item images; Dotabuff fills some newer entries that STRATZ does not mirror.

## Safety behavior

- Downloads use at most six concurrent requests by default.
- Existing files with a valid image signature are skipped unless `--force` is supplied.
- New files are written atomically and only accepted when their image signature matches the file type.
- PNG conversion uses lossless WebP and deletes a source PNG only after the WebP decoder validates its dimensions.
