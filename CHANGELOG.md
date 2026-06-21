# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

## [0.18.0] - 2026-06-21

### Added
- Add bucket pickup and placement mechanics for water and lava source blocks.
- Add raycasting support for fluids, targeting water and lava blocks only when holding a bucket (empty bucket, water bucket, or lava bucket).
- Add inventory hotbar updating and stack overflow drop logic when scooping fluids with a stacked empty bucket.
- Add synthesised procedural Web Audio API sound effects for filling (`playBucketFill`) and emptying (`playBucketEmpty`) buckets.

## [0.17.0] - 2026-06-21

### Added
- Add Smoker and Blast Furnace blocks support in the smelting UI with metadata-driven container types.
- Add double-speed (2x) smelting processing for Smoker and Blast Furnace blocks.
- Add item type filtering constraints: Smoker only processes food items, and Blast Furnace only processes ores and raw metals.
- Add expanded fuel verification system and lava bucket fuel support which leaves behind an empty bucket upon consumption.
- Add missing vanilla smelting recipes (raw iron, raw gold, raw copper, chicken, mutton, salmon, cod, potato, smooth stone, nether brick).

## [0.16.0] - 2026-06-21

### Added
- Add functional player crawling state (height = 0.6, eye height = 0.5) triggered automatically when a player is in a 1-block high space.
- Scale the third-person player model Y-axis when crawling to visualize the flat stance.

## [0.15.0] - 2026-06-21

### Added
- Add a full meta-cellular fluid simulation algorithm for water and lava supporting both spreading and receding/dry-up behaviors.
- Add infinite water source generation when a block has at least 2 horizontal water source neighbors and a solid/fluid support underneath.
- Add dynamic fluid-fluid interaction rules (water + lava相遇) resulting in obsidian or cobblestone block transformations.

### Changed
- Update fluid horizontal flow limits in the Overworld (water flows up to 8 blocks, lava flows up to 4 blocks).
- Queue neighboring fluid cells when any block is placed or broken to notify nearby fluids of pathways changing.

## [0.14.0] - 2026-06-21

### Added
- Add functional ladder and vine climbing mechanics with reduced horizontal speed, upward climbing on jump/forward, downward climbing on back, and a sneak-key (Shift) vertical holding state.
- Add custom flat wall-facing meshing for ladders in `Chunk.ts` based on their placed block face metadata.
- Add a new procedural pixel-art wood texture for the ladder block in `TextureAtlas.ts`.

### Changed
- Exclude the ladder block from solid collision checks in `BlockRegistry.ts` so players can walk through and occupy ladder voxels.
- Auto-resolve ladder placement facing metadata in `Game.ts` when placed on top or bottom block faces by checking neighboring solid walls.

## [0.13.0] - 2026-06-21

### Changed
- Change the creative-mode flying toggle from the `G` key to double-tapping the spacebar to align with vanilla Minecraft control conventions and resolve a shortcut conflict with offhand swapping (`F`).

## [0.12.0] - 2026-06-20

### Added
- Add sword sweep attacks that damage and knock back nearby forward-facing mobs after charged grounded sword hits, with sweep particle feedback.

## [0.11.0] - 2026-06-20

### Added
- Add weapon-aware melee attack cooldown with damage scaling, charged-hit critical gating, and HUD recovery feedback for close combat.

## [0.10.0] - 2026-06-20

### Added
- Add falling melee critical hits with 1.5x damage against mobs and the Ender Dragon, gated by non-flying/non-riding/non-fluid airborne conditions and highlighted with critical hit particles.

## [0.9.0] - 2026-06-20

### Added
- Add firework rocket launching with support for legacy and modern rocket item IDs, accelerating flight, timed or impact explosions, colorful particles, area damage, and survival-mode item consumption.

## [0.8.0] - 2026-06-20

### Added
- Add throwable tridents with a dedicated projectile mesh, gravity, impact damage, hit particles, survival-mode hand removal, and recoverable item drops on impact.

## [0.7.0] - 2026-06-20

### Added
- Add fishing rod casting and reeling with a visible bobber, water bite timing, fish loot, XP rewards, rod durability loss, and cleanup when the bobber is reeled or the rod breaks.

## [0.6.0] - 2026-06-20

### Added
- Add throwable snowballs, eggs, and ender pearls with arcing flight, impact particles, item consumption, egg chick hatching chance, blaze snowball damage, and ender-pearl teleport damage.

## [0.5.0] - 2026-06-20

### Added
- Add vanilla-style sneaking with Shift movement slowdown, lowered eye/collision height, third-person crouch posture, and edge protection while walking near block drops.

### Changed
- Reserve Ctrl for sprinting so Shift consistently controls sneak and dismount behavior.

## [0.4.0] - 2026-06-20

### Added
- Add vanilla-style bow charging: hold right click to draw, release to fire, with charge-scaled arrow speed/damage, arrow consumption on release, and HUD charge feedback.

## [0.3.0] - 2026-06-20

### Added
- Add shield blocking with main-hand/offhand activation, frontal damage interception, shield durability loss, movement slowdown, and HUD feedback.
- Add an offhand inventory slot with F-key hotbar swapping, inventory UI support, HUD display, save/load persistence, death drops, and multiplayer inventory sync.
- Add runtime data pack loading for declarative block, item, and crafting recipe overrides, with a default data pack manifest and authoring documentation.
- Add resource pack manifests with runtime texture-atlas overrides, external sound overrides, a default pack manifest, and resource-pack authoring documentation.
- Add filled maps with biome/height sampling plus readable map UI, and add writable/signed book item metadata with an in-game book editor for the stage 5.8 gameplay slice.
- Add deterministic woodland mansions and pillager outposts with loot rooms, tower rewards, and pillager guards for the stage 3.9 gameplay slice.
- Add biome-specific desert temples, jungle temples, and witch huts with traps, redstone details, interior props, and deterministic loot for the stage 3.7 gameplay slice.
- Add abandoned mineshaft generation with wooden tunnel supports, rails, cobwebs, torches, and deterministic loot chests for the stage 3.6 gameplay slice.
- Add underground dungeon generation with mossy cobblestone rooms, spawner metadata, discoverable openings, chests, and deterministic loot for the stage 3.5 gameplay slice.
- Add End outer-island chorus trees, simplified End Cities, loot chests, Shulkers, Shulker bullets, and Levitation status effects for the stage 3.4 gameplay slice.

### Changed
- Move the creative-mode fly toggle to G so F matches vanilla-style main hand/offhand swapping.

### Fixed
- Use each mob instance's current width and height for entity collision checks so resized mobs collide with their actual body dimensions.
- Keep default overworld spawning and legacy spawn saves away from stale or submerged terrain near sea level.
- Refresh fluid flow immediately after block removal and keep full/source fluid surfaces at full voxel height.
