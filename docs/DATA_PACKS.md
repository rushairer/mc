# Data Packs

Data packs let the runtime append or override declarative block, item, and crafting recipe definitions without rebuilding the bundled JSON files.

## Loading

The game loads `/data-packs/default/pack.json` by default. To test another pack, pass a manifest URL with the `dataPack` query parameter:

```text
/?dataPack=/data-packs/my-pack/pack.json
```

The selected URL can also be stored in local storage under `mc.dataPackUrl`.

## Manifest

```json
{
  "pack": {
    "name": "Example Data Pack",
    "description": "Adds a luminous custom block and a recipe.",
    "version": "0.2.0"
  },
  "blocks": [
    {
      "id": 9000,
      "officialId": "example:glowing_basalt",
      "name": "glowing_basalt",
      "displayName": "Glowing Basalt",
      "textureKey": "basalt",
      "transparent": false,
      "solid": true,
      "hardness": 1.25,
      "toolCategory": "pickaxe",
      "luminance": 10
    }
  ],
  "items": [
    {
      "id": 9000,
      "officialId": "example:glowing_basalt",
      "name": "glowing_basalt",
      "displayName": "Glowing Basalt",
      "category": "block",
      "placeBlockId": 9000
    }
  ],
  "recipes": {
    "9000": [
      {
        "inShape": [[87], [348]],
        "result": { "id": 9000, "count": 1 }
      }
    ]
  }
}
```

## Compatibility Contract

- Block and item IDs are runtime IDs. Pick IDs outside the vanilla range for custom content.
- Reusing an existing ID intentionally overrides that runtime definition after the pack loads.
- Recipes use the same shaped and shapeless structure as `src/items/data/recipes.json`.
- Resource packs still own textures and sounds. Data packs reference texture keys that the active resource pack or built-in atlas can resolve.
