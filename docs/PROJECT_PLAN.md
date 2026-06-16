# Minecraft Clone Roadmap

> Tech stack: React 18 + TypeScript + Vite 4 + Three.js
> Current goal: keep improving the clone in small, verifiable stages and push each stable milestone to the main branch.

## Current Fit Against Vanilla Minecraft

This project already covers the recognizable core loop:

- Chunked voxel terrain with block breaking and placement.
- First-person controls, collision, sprinting, jumping, fly toggle, and third-person camera.
- Procedural terrain with basic biomes, caves, trees, ores, water, and lava.
- Inventory, hotbar, crafting table, furnace, tools, armor, food, health, hunger, oxygen, and death/respawn.
- Basic mobs, drops, combat, particles, procedural sounds, weather, day/night lighting, fluid spread, redstone components, and a Nether generator scaffold.
- IndexedDB save/load for loaded chunks, player state, and inventory.

The gap with vanilla Minecraft is now less about the existence of a block world and more about depth, scale, correctness, and content density.

## Major Gaps

### World And Terrain

- No modern worldgen layers such as rivers, beaches, villages, structures, ravines, mineshafts, dungeons, strongholds, lush caves, dripstone caves, or deep dark.
- Biomes are broad placeholders and do not have distinct vegetation, colors, mobs, temperatures, or local blocks.
- Bedrock is represented by stone, and ore distribution is simplified.
- Chunk generation and meshing run on the main thread, so render distance and terrain complexity are capped by frame-time.
- Save data only covers loaded chunks; there is no multi-world menu, seed UI, or explicit world management.

### Blocks And Items

- Only a small subset of vanilla blocks and items exists.
- No slabs, stairs, doors, trapdoors, fences, signs, crops, beds, chests, boats, minecarts, rails, bows, arrows, shields, buckets with fluid pickup, or maps.
- Block state is mostly just an ID; many vanilla blocks need orientation, age, power, waterlogging, open/closed, lit/unlit, and inventory data.
- Tool requirements, harvest levels, durability behavior, stack rules, and drops are simplified.

### Survival And Progression

- No XP bar, enchanting, brewing, anvil, smithing, advancement system, sleeping, spawn-point management, or difficulty modes.
- No farming loop beyond basic food items.
- No villager trading, raids, pets, mounts, fishing, or loot tables.
- Combat lacks shields, bows, projectiles, armor toughness, critical hits, status effects, and detailed mob behaviors.

### Mobs And AI

- Existing mobs are simplified mesh models with basic wander/chase/attack behavior.
- Creepers do not yet have fuse/explosion block destruction.
- Skeletons do not shoot arrows, spiders do not climb, zombies do not burn in daylight, passive mobs do not breed, and chickens do not drop eggs.
- Spawn rules use simplified sky exposure/light checks rather than true light propagation, pack spawning, biome tags, and despawn rules.

### Dimensions And Bosses

- Nether generation exists as a scaffold, but there is no complete dimension switching loop with persistent separate chunk stores.
- No End portal, End dimension, Ender Dragon, credits flow, or dragon fight mechanics.
- Portals are placeholders rather than true portal blocks with orientation, cooldown, and dimension target behavior.

### Rendering And Feel

- Lighting is scene-level plus a few nearby point lights, not true block light and sky light propagation.
- Water/lava are not animated/translucent like vanilla and do not maintain fluid levels as block state.
- No clouds, sun/moon billboards, stars, biome tinting, held item polish for every item, or complete UI parity.
- Procedural audio exists, but there is no ambient music or biome/underground ambience.

### Engineering And QA

- No automated unit tests or browser smoke tests are committed yet.
- No worker pipeline for generation/meshing.
- Docs mention systems that are only simplified or scaffolded; this roadmap should stay updated with each milestone.

## Staged Plan

### Stage 1 - System Consistency And Baseline QA

Goal: make existing systems agree with each other and establish a stable verification loop.

- Use one shared game-time night/day source for sky, weather, UI, and mob spawning.
- Add a short browser smoke checklist for load, canvas render, inventory open/close, hotbar, block placement, and block breaking.
- Keep `npm run build` green before every push.
- Update this roadmap after each milestone.

Acceptance:

- Build passes.
- App loads without framework overlay or console errors.
- Debug overlay reports changing FPS/chunks/player coordinates.
- Mob spawning follows the in-game night state rather than wall-clock time.

### Stage 2 - Block State Foundation

Goal: unblock doors, beds, crops, chests, redstone correctness, and portals.

- [x] Introduce sparse per-block metadata storage alongside block IDs.
- [x] Persist metadata in IndexedDB with backward compatibility for older saves.
- [x] Restore saved chunk block data on load instead of only saving it.
- [x] Store placement facing metadata for blocks that need orientation.
- [x] Persist redstone component type, facing, powered state, signal strength, and piston extension state.
- [ ] Use metadata to render directional block variants where the current mesh needs visible orientation.
- [ ] Extend metadata-backed behavior to containers, beds, crops, doors, trapdoors, and portals.

Acceptance:

- Existing saves still load gracefully.
- Saved chunk edits restore after reload.
- Metadata-backed block state survives save/load.
- Redstone components keep their state after reload.

### Stage 3 - Core Vanilla Blocks And Utility Loop

Goal: make the survival/building loop feel much closer to early Minecraft.

- [x] Add single chest block, recipe, texture, UI, and persistent 27-slot container data.
- [x] Add single oak door block, recipe, texture, two-block placement, open/close metadata, and linked breaking.
- [ ] Add double chest merging.
- [ ] Improve door rendering from full-block placeholder to thin directional geometry.
- [ ] Add trapdoors, fences, stairs, slabs, bed, ladder, crops, seeds planting, and simple farmland hydration.
- [ ] Add bucket pickup/place for water and lava.
- [ ] Expand recipes and drops to support the new loop.

Acceptance:

- Player can build a basic house with door, bed, chest, stairs/slabs, and farm.
- Bed sets spawn and skips night when conditions are safe.
- Chests and crops persist through save/load.

### Stage 4 - Combat And Mob Depth

Goal: make hostile encounters recognizable and tactical.

- Add creeper fuse and explosion terrain damage.
- Add skeleton arrows and projectile collision.
- Add zombie daylight burning and spider climbing or leap behavior.
- Add bows, arrows, shield, armor mitigation tuning, and basic XP drops.

Acceptance:

- Each hostile mob has a distinct threat pattern.
- Explosions modify terrain and play particles/sound.
- Combat outcomes account for armor and shield use.

### Stage 5 - Lighting, Fluids, And Atmosphere

Goal: improve the feel of caves, night, water, and exploration.

- Add block light and sky light propagation data per chunk.
- Make mob spawning depend on actual light levels.
- Improve water/lava levels, source behavior, and water-lava interactions.
- Add sun, moon, stars, clouds, biome tinting, and ambient music.

Acceptance:

- Torches affect local block brightness and spawn safety.
- Caves read as dark without torches.
- Water and lava spread in predictable, bounded ways.

### Stage 6 - Dimensions And Endgame

Goal: complete the adventure arc.

- Implement persistent Overworld/Nether/End chunk stores.
- Finish Nether portal teleportation and coordinate scaling.
- Add End portal activation, End dimension generation, Ender Dragon, obsidian pillars, crystals, and credits/end state.

Acceptance:

- Player can travel Overworld -> Nether -> Overworld with stable portals.
- Player can reach the End and fight a functional Ender Dragon encounter.

### Stage 7 - Performance And Scale

Goal: support larger worlds and smoother play.

- Move world generation and mesh building to Web Workers.
- Add chunk build queues with distance priority and cancellation.
- Add geometry/material pooling.
- Add optional settings for render distance, FOV, sensitivity, graphics, and audio.

Acceptance:

- 12 chunk render distance is playable on target desktop browsers.
- Chunk loading no longer causes major frame spikes during walking/flying.

## Commit Policy

- Each stage should land as one or more small commits on the current main branch.
- Every commit should pass `npm run build`.
- For rendered changes, run a browser smoke test before pushing.
- Keep `docs/PROJECT_PLAN.md` current when feature scope or status changes.
