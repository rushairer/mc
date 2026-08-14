# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

### Added
- Add a deterministic, persisted 20 TPS world scheduler for neighbor updates, fluid propagation, and block events.
- Add save schema v3 with automatic v2 migration and validation, deduplication, dimension scoping, and recovery of pending block ticks.
- Add stable `behaviorId` bindings to block and item definitions, including data-pack overrides and automatic compatibility mappings for existing registry entries.
- Add block, item, and entity behavior registry interfaces; Cauldrons, Composters, Cakes, Bells, Campfires, supported passive mobs, pets, villagers, and rideable entities now use shared interaction dispatchers.
- Add a continuous item-use lifecycle with explicit start, progress, completion, release, interruption, and item-switch callbacks.
- Add loadable Crossbows with Survival ammo consumption, persisted loaded-projectile state, durability loss, and dedicated firing behavior.
- Add a pure block-placement planner with replayable decisions for face offsets, support checks, player collision, sign variants, and slab merging.
- Add dedicated fallback item icons and held-item models for Bow, Crossbow, Arrow variants, Fishing Rod, Trident, Snowball, Egg, Ender Pearl, and Eye of Ender instead of generic flat item placeholders.
- Add a procedural bow-shot sound with resource-pack hooks for `entity.arrow.shoot` and `item.crossbow.shoot`.
- Add data-driven block tags (`minecraft:mineable/pickaxe|axe|shovel|hoe` and `minecraft:needs_stone|iron|diamond_tool`) inferred at registry load, with built-in name overrides and full data-pack replacement through `BlockDef.tags`.
- Add tool harvest tiers (wood/gold 0, stone 1, iron 2, diamond 3, netherite 4): a wrong-tier tool now breaks harvest-gated blocks at hand speed and drops nothing, matching Java 1.20.1.
- Add a data-driven loot table system (`LootSystem`): a pure, replayable roll engine now drives block drops (replacing the legacy `BLOCK_DROP_OVERRIDES`, including the 10% gravel-flint roll) and fishing loot, with named tables addressable from `BlockDef.lootTable` for data packs.
- Add data-driven XP rules: ore mining XP (coal 0-2, diamond/emerald 3-7, lapis 2-5, redstone 1-5, nether quartz 2-5, nether gold 0-1, with deepslate variants), plus centralized fishing (1-6) and breeding (1-7) XP ranges.

### Changed
- Route workstations, containers, wooden doors and trapdoors, Beds, redstone controls, Buckets, Boats, Minecarts, Hoes, maps and books, Fishing Rods, throwable items, and Eyes of Ender through the shared behavior dispatcher.
- Route Bow charging, Shield use, food eating, potion drinking, animal breeding and growth, pet taming/healing/sitting, villager trading, and entity riding through behavior lifecycles.
- Route every placeable block item, including data-pack declarations and block-as-item fallbacks, through the shared item behavior dispatcher.
- Make wolf and cat taming rolls replayable from the world seed, simulation tick, entity, and held item.
- Let block behaviors explicitly decide whether a failed interaction suppresses fallback food or potion use, replacing the duplicated interactive-block name list.
- Drive water and lava updates from scheduled world ticks instead of a frame-time queue, preserving pending propagation across saves and unloaded dimensions.
- Schedule Campfire cooking by per-slot completion ticks instead of scanning every loaded block-metadata entry each frame; existing cooking progress is converted automatically when an older save loads.
- Bow firing now supports normal, spectral, and tipped arrows as ammo, consumes bow durability in Survival mode, and uses a distinct shoot feedback instead of the player hurt sound.
- Creative flight help text now documents double-space to toggle flight and Space/Shift for vertical flight; F is documented only as the offhand swap key.
- Replace the hardcoded block drop override map with data-driven loot tables, and route fishing loot through the same weighted roll engine.
- Make breeding and fishing XP rolls use the centralized `XpRules` data instead of inline `Math.random` arithmetic.
- Document the current multiplayer status as an experimental WebSocket mode: local/server join, movement, chat, chunks, basic block edits, mobs, drops, and weather/time sync are present, while full authoritative survival gameplay and item actions still need incremental work.

### Fixed
- Preserve block-before-item interaction priority for registered workstations and controls, and stop bare-hand interaction from opening Iron Doors or Iron Trapdoors.
- Preserve entity-before-item interaction priority so food used to breed or tame a targeted mob is not eaten by the player, and cancel active use when a block or entity claims the interaction.
- Keep a consumed Potion stack unchanged in Creative mode instead of replacing it with a Glass Bottle.
- Keep Trapdoors on the single-block placement path instead of misclassifying names ending in `trapdoor` as two-block Doors.
- Merge compatible legacy and modern Slabs at the targeted block; modern Slabs now persist and render their canonical `type=double` state.
- Process full redstone simulation for every catch-up tick so Observer pulses and signal propagation do not become frame-rate dependent.
- Fix flying descent so holding Shift while flying moves the player downward.
- Fix singleplayer local simulation being paused by the in-memory mock connection, which caused arrows, mobs, drops, and damage updates to appear stuck.

## [0.29.0] - 2026-06-21

### Added
- Implement Campfire cooking: right-clicking raw cookable food onto Campfires or Soul Campfires stores up to four items, cooks them over time, drops the cooked output with XP, and persists progress in block metadata.
- Render Campfires as low log-and-coal assemblies with visible food items placed on top while cooking.

## [0.28.0] - 2026-06-21

### Added
- Implement Bell interaction: right-clicking a Bell plays a resonant bell sound with visual feedback.
- Render Bells with a smaller hanging body and support shape instead of a full-block placeholder.

## [0.27.0] - 2026-06-21

### Added
- Implement Composter gameplay: compostable plant and crop items can be inserted to raise stored compost level, full Composters produce Bone Meal, and compost level persists in block metadata.
- Render Composters as hollow containers with visible fill height matching their compost level.

## [0.26.0] - 2026-06-21

### Added
- Implement Cauldron bucket interactions: water and lava buckets fill empty Cauldrons, and empty buckets collect full water or lava Cauldrons back into bucket items.
- Render Cauldrons as hollow containers with visible water or lava surfaces for filled states.

### Fixed
- Make all Cauldron states drop the Cauldron item instead of state-specific block IDs when broken.

## [0.25.0] - 2026-06-21

### Added
- Implement Barrel container behavior: right-clicking a placed Barrel opens a 27-slot storage UI, persists inventory in block metadata, and drops stored items when broken.
- Add localized Barrel UI titles in English, Simplified Chinese, and Traditional Chinese.

## [0.24.0] - 2026-06-21

### Added
- Implement Cake block eating: right-clicking a placed Cake restores hunger, plays eating feedback, persists bite progress in block metadata, and removes the block after the final bite.
- Render placed Cakes with vanilla-style half-height inset bounds that shrink across bite stages.

### Changed
- Make placed Cakes behave like vanilla consumable blocks by dropping no item when broken after placement.

## [0.23.0] - 2026-06-21

### Added
- Implement Bed block placement: placing a Bed places a 2-voxel double block (head and foot parts) aligned to the player's horizontal direction, with proper metadata checks to prevent player collision overlaps or clipping.
- Implement night-skipping sleep logic: right-clicking a Bed block at night skips time to morning (setting game time to sunrise/0.0), triggering immediate chunk light rebuilds.
- Implement Bed cascade destruction: destroying either the head or foot part recursively destroys the other half without duplicating item drops.
- Map Bed block breaks to drop the Bed inventory item (ID 355).

## [0.22.0] - 2026-06-21

### Added
- Implement double chest merging: placing two single chest blocks adjacent horizontally merges their inventories into a single 54-slot UI container (represented by a Proxy and synchronized to IndexedDB on UI changes).
- Add new translations for `"doubleChest"` key in English, Simplified Chinese, and Traditional Chinese.

### Changed
- Refactor `ChestUI` React component to dynamically support variable slots lengths and render the appropriate title.

## [0.21.0] - 2026-06-21

### Added
- Implement complete piston block extension mechanics, including block pushing and metadata relocation (so container contents and orientations are correctly preserved when pushed).
- Implement sticky piston retraction block pulling, including metadata relocation.
- Implement unified block breaking helper `destroyBlockAt` that automatically cleans up blocks, metadata, redstone registrations, and handles dependency cascades recursively (such as breaking pistons together with their piston heads, doors, crops, and nether wart).

### Changed
- Refactor `RedstoneSystem` to delegate physical block movements to the game loop.
- Refactor the player block breaking and explosion routines to use the unified `destroyBlockAt` cascade method.

## [0.20.0] - 2026-06-21

### Added
- Add directional block face rendering and custom textures for chests, furnaces (inactive and active), smokers (inactive and active), blast furnaces (inactive and active), normal pistons, sticky pistons, and piston heads.
- Add procedural chunk-mesh generation for extended piston bases and composite piston heads (split plate and shaft bounds).
- Implement background smelting simulation in `Game.ts` that ticks furnaces, smokers, and blast furnaces, updating cook times and fuel burn states even when the container UI is closed.
- Support smelting fuel lava bucket consumption, returning an empty bucket to the fuel slot when consumed.
- Support 2x double-speed smelting rates for Smoker and Blast Furnace blocks in the simulation loop.

### Changed
- Refactor `FurnaceUI` to synchronize and render smelting progress directly from chunk metadata parameters (`burnTime`, `cookTime`, and `maxBurnTime`) instead of simulating progress locally in React state.
- Add `sticky` flag to `BlockMetadata` to control sticky vs regular piston head visual resolves.

## [0.19.0] - 2026-06-21

### Added
- Add farmland block (ID 60) with procedural dry and moist textures featuring horizontal furrow lines.
- Add hoe right-click interaction to till dirt and grass blocks into farmland, with automatic water proximity detection for initial moisture.
- Add farmland hydration system: moisture level (0-7) stored in block metadata, automatically updated by random ticks based on nearby water sources within a 9×2×9 area.
- Add farmland decay: dry farmland without crops reverts to dirt; solid blocks placed on farmland also cause reversion.
- Add crop placement restrictions: wheat seeds, carrots, and potatoes can only be planted on farmland blocks.
- Add procedural multi-stage textures for wheat (stages 0-7), carrots (stages 0-7), and potatoes (stages 0-7) with visually distinct growth progression.
- Add crop growth random tick system: crops grow faster on hydrated farmland (25% chance) vs dry farmland (10% chance) per tick.
- Add crop-specific drop logic: mature wheat drops 1 wheat + 1-3 seeds; mature carrots/potatoes drop 1-4 items; immature crops drop 1 seed/item.
- Add crop destruction cascade: breaking farmland or the block below a crop destroys the crop and spawns appropriate drops.
- Add carrot and potato procedural item icons for inventory display.

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
