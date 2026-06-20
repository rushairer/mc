# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

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
