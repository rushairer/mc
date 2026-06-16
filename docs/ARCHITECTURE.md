# Architecture

## Overview

A Minecraft clone built with a **React UI layer** on top of a **Three.js voxel engine**. React handles menus, HUD, inventory screens. Three.js handles all 3D rendering and runs a 60fps game loop independent of React's render cycle.

```
┌─────────────────────────────────────────────┐
│                  React UI                    │
│  (HUD, Inventory, Crafting, Debug Overlay)   │
├─────────────────────────────────────────────┤
│                Game Engine                   │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Renderer│ │ Game Loop │ │ InputManager │  │
│  └────┬────┘ └─────┬────┘ └──────┬───────┘  │
│       │            │              │          │
│  ┌────▼────────────▼──────────────▼───────┐  │
│  │            World (state)               │  │
│  │  ┌──────────┐ ┌───────────┐            │  │
│  │  │ Chunks[] │ │ BlockReg  │            │  │
│  │  └──────────┘ └───────────┘            │  │
│  └────────────────────────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Player   │ │ Physics  │ │ MobSystem    │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
└─────────────────────────────────────────────┘
```

## Core Systems

### 1. Renderer (`src/engine/Renderer.ts`)

- Creates `THREE.WebGLRenderer`, `Scene`, `PerspectiveCamera`
- Manages render loop via `requestAnimationFrame`
- Sky color changes with day/night cycle
- Fog for draw distance culling

### 2. Chunk System (`src/world/Chunk.ts`, `ChunkManager.ts`)

**Chunk data**: Each chunk is a flat `Uint8Array` of size `16 × 256 × 16`. Each byte is a block ID.

```
index = x + z * 16 + y * 16 * 16
```

**ChunkManager** maintains a `Map<string, Chunk>` keyed by `"x,z"`. On each frame:
1. Calculate which chunks should be loaded (player position ± render distance)
2. Generate new chunks that are in range but not loaded
3. Unload chunks beyond render distance
4. Rebuild meshes for dirty chunks

**Dirty flag**: Any block change marks the chunk (and potentially neighbors) as dirty. Only dirty chunks get their mesh rebuilt.

### 3. Mesh Generation (`src/world/GreedyMesher.ts`)

Uses **greedy meshing** to minimize triangle count:
- For each axis (X, Y, Z), sweep through blocks
- Merge adjacent same-type visible faces into larger quads
- Only emit faces adjacent to air (or transparent blocks)
- Each face gets UV coordinates mapped to the texture atlas

**Output**: `THREE.BufferGeometry` with position, normal, uv, and color attributes.

### 4. Texture Atlas (`src/engine/TextureAtlas.ts`)

All block textures packed into a single `256×256` atlas (16 textures × 16 textures, each 16×16px). UV coordinates reference atlas positions.

**Block face textures**: Some blocks have different textures per face (e.g., grass: top=green, side=grass_dirt, bottom=dirt). Defined in `BlockRegistry`.

### 5. Player Physics (`src/player/Player.ts`)

- Position stored as `THREE.Vector3`
- Velocity as `THREE.Vector3`
- **Gravity**: -20 units/s²
- **Jump velocity**: +8 units/s
- **Walk speed**: 4.3 units/s, **Sprint**: 5.6 units/s
- **AABB collision**: Player hitbox is 0.6×1.8×0.6. Check against surrounding blocks, resolve by pushing out along the smallest overlap axis.
- **Ground detection**: Check block below player feet

### 6. Input Manager (`src/engine/InputManager.ts`)

- Pointer lock on canvas click
- Mouse movement → camera pitch/yaw
- Keyboard state tracked in a `Set<string>`
- Mouse buttons for attack (left) and use (right)
- Scroll wheel for hotbar slot selection
- Key bindings match Minecraft defaults (WASD, Space=jump, Shift=sneak, E=inventory)

### 7. Raycasting (`src/player/PlayerController.ts`)

For block interaction:
- Cast ray from camera position along camera forward vector
- Step through voxels using **DDA (Digital Differential Analyzer)** algorithm
- Max reach distance: 4.5 blocks
- Return block position + face normal for placement

### 8. World Generation (`src/world/WorldGen.ts`)

**Height map**: 2D Simplex noise, multiple octaves
```
height(x,z) = Σ (amplitude * noise2D(x * frequency, z * frequency))
              for each octave
```

**Biome selection**: Use temperature + humidity noise to select biome. Each biome modifies terrain parameters (base height, amplitude, stone depth).

**Cave carving**: 3D Simplex noise. If `noise3D(x,y,z) > threshold`, carve air.

**Ore placement**: Per-chunk pass. For each ore type, attempt N random placements at valid depth ranges.

**Trees**: After terrain, scan surface for valid tree positions. Generate trunk + leaf canopy.

### 9. Block Registry (`src/world/BlockRegistry.ts`)

```typescript
interface BlockDef {
  id: number;
  name: string;
  textures: { top: string; bottom: string; side: string };
  transparent: boolean;
  solid: boolean;
  hardness: number;    // seconds to break by hand
  tool?: ToolType;     // best tool category
  drops?: number;      // block ID dropped (default: self)
}
```

**Block IDs** (matching Minecraft where possible):
```
0=air, 1=stone, 2=grass, 3=dirt, 4=cobblestone, 5=oak_planks,
6=oak_log, 7=leaves, 8=sand, 9=gravel, 10=gold_ore, 11=iron_ore,
12=coal_ore, 13=water, 14=lava, 15=sandstone, 16=wool,
17=gold_block, 18=iron_block, 19=bricks, 20=bookshelf,
...
```

### 10. UI Layer (`src/ui/`)

React components rendered via `createRoot` into a div overlaying the canvas. The UI communicates with the game engine through a shared state store (simple event emitter / zustand).

- **HUD**: Always visible — hotbar, crosshair, health hearts, hunger bars
- **Inventory**: Toggle with E key — 27+9 grid + crafting output
- **Crafting**: 2×2 (hand) or 3×3 (crafting table) grid
- **Debug**: F3 overlay — FPS, XYZ, biome, chunk count

### 11. Game Loop (`src/engine/Game.ts`)

```
function gameLoop(delta: number):
  1. Process input
  2. Update player physics
  3. Update mob AI
  4. Update fluid simulation
  5. Update lighting
  6. Load/unload chunks
  7. Rebuild dirty chunk meshes
  8. Render scene
  9. Update UI state
```

Fixed timestep at 20 ticks/sec for physics/logic. Rendering is uncapped (requestAnimationFrame).

### 12. Save System (`src/systems/SaveSystem.ts`)

- Chunk data stored in IndexedDB as raw `Uint8Array`
- Player position, inventory, health stored separately
- On save: serialize all loaded chunks + player state
- On load: deserialize, set player position, trigger chunk loading

## Performance Considerations

1. **Greedy meshing**: Reduces face count by 80-90% vs naive per-block rendering
2. **Frustum culling**: Three.js handles this per-chunk mesh
3. **Chunk pooling**: Reuse chunk objects instead of GC
4. **Web Workers** (future): Offload mesh generation and world gen to workers
5. **Instanced rendering** (future): For repeated elements like tall grass, flowers

## Phase 3 — Game Systems (Implemented)

### Inventory (`src/player/Inventory.ts`)
- 36 slots: indices 0-8 = hotbar, 9-35 = main inventory
- 4 armor slots: helmet, chestplate, leggings, boots
- `addItem(id, count)` — auto-stacks, returns leftover
- `removeFromSlot(index, count)` — removes from specific slot
- Serialized via `toJSON()` / `fromJSON()` for save system

### Item Registry (`src/items/ItemRegistry.ts`)
- Block items: IDs 1-99 (match BlockRegistry)
- Material items: IDs 100-119 (stick, coal, iron_ingot, diamond, etc.)
- Tools: IDs 120-169 (5 materials × 4 types: sword/shovel/pickaxe/axe)
- Food: IDs 170-179 (apple, bread, steak, porkchop)
- Armor: IDs 180-195 (iron + diamond × 4 slots)
- `getBreakTime(blockId, heldItemId)` — calculates mining speed
- `getBlockDropItem(blockId)` — what drops when block breaks

### Crafting (`src/items/CraftingRecipes.ts`)
- Pattern-based recipe matching (3×3 grid)
- Supports shaped and shapeless recipes
- `findCraftingResult(grid)` — checks all recipes against 9-item grid

### Furnace (`src/items/SmeltingRecipes.ts`)
- Input → Output + XP recipes
- Cook time: 10 seconds per item
- Fuel: coal (101), planks (5), logs (6)

### Survival System (`src/systems/SurvivalSystem.ts`)
- Fall damage: >3 blocks = (distance-3) hearts
- Drowning: 3 seconds underwater → 2 damage per second
- Starvation: hunger=0 → 1 damage per 4 seconds
- Runs every frame via `update(dt, player, getBlock, damage)`

### Save System (`src/systems/SaveSystem.ts`)
- IndexedDB storage (DB: `minecraft_clone_save`, store: `worlds`)
- Saves: player position/health/hunger, inventory, chunk data, seed
- Auto-save every 60 seconds
- Also saves on game dispose (tab close)

### UI Components
- `InventoryUI.tsx` — Full inventory with crafting grid (E key)
- `FurnaceUI.tsx` — Furnace input/fuel/output slots
- `HUD.tsx` — Hotbar with actual item names and counts

## Adding New Features

To add a new **block type**:
1. Add entry to `BlockRegistry` with ID, textures, properties
2. Add texture to `TextureAtlas.ts` via `drawTile()`
3. Block is automatically available as an inventory item (IDs 1-99)

To add a new **item** (non-block):
1. Add entry to `ItemRegistry` with ID ≥100
2. Add crafting recipe to `CraftingRecipes.ts` if craftable
3. Add smelting recipe to `SmeltingRecipes.ts` if smeltable

To add a new **mob**:
1. Define mob class in `src/systems/MobSystem.ts`
2. Add model geometry and animations
3. Register spawn rules (biome, light level, group size)

To add a new **dimension** (Nether/End):
1. Create new `WorldGen` variant
2. Add portal block type with teleportation logic
3. Separate chunk storage per dimension
