# Resource Packs

Resource packs are loaded from a `pack.json` manifest. The default pack lives at `/resource-packs/default/pack.json` and intentionally contains no overrides, so the game falls back to its built-in procedural textures and synthesized sounds.

## Enable A Pack

Use either option:

- Add `?resourcePack=/resource-packs/my-pack/pack.json` to the game URL.
- Store a URL in `localStorage` with key `mc.resourcePackUrl`.

The manifest URL is the base path for relative asset paths.

## Manifest

```json
{
  "pack": {
    "name": "My Pack",
    "description": "Short human-readable description.",
    "version": "1.0.0"
  },
  "textures": {
    "stone": "textures/block/stone.png",
    "icon:block:stone": "textures/block/stone_icon.png",
    "diamond": "textures/item/diamond.png"
  },
  "sounds": {
    "block.break.1": "sounds/block/stone_break.ogg",
    "block.step": [
      "sounds/block/step_1.ogg",
      "sounds/block/step_2.ogg"
    ],
    "entity.creeper.fuse": "sounds/entity/creeper_fuse.ogg"
  },
  "models": {}
}
```

Texture keys match the existing atlas keys used by blocks, items, and icons. Images are scaled into 16x16 atlas tiles with nearest-neighbor sampling.

Sound keys can target a specific block id, such as `block.break.1`, or a fallback category, such as `block.break`. Supported high-level categories include `block.break`, `block.place`, `block.step`, `item.pickup`, `entity.experience_orb.pickup`, `entity.generic.explode`, `entity.lightning_bolt.thunder`, `entity.player.hurt`, `entity.mob.hurt`, `entity.mob.death`, `entity.<mob>.ambient`, `entity.creeper.fuse`, `entity.generic.eat`, `entity.generic.drink`, `entity.player.burp`, `block.lever.click`, `block.piston.extend`, `block.piston.contract`, and `ui.advancement`.

The `models` field is reserved for pack compatibility. Rendering still uses the current built-in block and entity geometry.
