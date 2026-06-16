# MineCraft Clone — Project Plan

> **Tech Stack**: React 18 + TypeScript + Vite 4 + Three.js
> **Target**: Desktop Chrome/Firefox, 60fps with 12-chunk render distance
> **Node**: 16+ compatible (uses Vite 4)

---

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Core Engine | **DONE** | Chunk system, player controls, block interaction |
| 2 — World Gen | **DONE** | Simplex noise terrain, 6 biomes, caves, trees, ores |
| 3 — Game Systems | **DONE** | Inventory, crafting, furnace, survival, save/load |
| 4 — Content | NOT STARTED | Mobs, day/night, fluids, redstone, Nether/End |

---

## Phase 1 — Core Engine (Current)

**Goal**: Walk around a flat/blocky world, place and break blocks.

### Deliverables
- [x] Vite + React + Three.js project scaffold
- [x] Chunk-based voxel renderer (16×256×16 chunks)
- [x] Face-culling mesh optimization
- [x] First-person camera + pointer lock
- [x] WASD movement, jumping, gravity, AABB collision
- [x] Block breaking (left click) and placement (right click) via raycasting
- [x] Hotbar UI (9 slots, scroll wheel selection)
- [x] 30 block types (stone, grass, dirt, ores, wood, leaves, sand, water, etc.)
- [x] Procedural texture atlas (no external files needed)
- [x] 6 biomes (Plains, Desert, Mountains, Forest, Snow, Ocean)
- [x] Cave generation with 3D noise
- [x] Tree generation per biome
- [x] Ore distribution (coal, iron, gold, diamond)
- [x] Debug overlay (F3)
- [x] Fly mode (F key)
- [x] Day/night cycle (background color)
- [x] Build verified (tsc + vite build pass)

### Acceptance Criteria
- Render distance of 8+ chunks without frame drops
- Player can walk, jump, fall, collide with terrain
- Blocks can be placed and broken in real-time
- Hotbar displays selected block

---

## Phase 2 — World Generation

**Goal**: Infinite procedural terrain with varied biomes.

### Deliverables
- [ ] 2D/3D Simplex noise terrain generation
- [ ] Biome system (plains, desert, mountains, forest, ocean, snow)
- [ ] Cave generation (3D noise carving)
- [ ] Tree generation (oak, birch, spruce, jungle)
- [ ] Ore distribution (coal, iron, gold, diamond, redstone, lapis)
- [ ] Water bodies at sea level
- [ ] Chunk loading/unloading with distance-based priority

### Acceptance Criteria
- World generates seamlessly as player walks
- Biome transitions are smooth
- Caves are explorable and lit
- Trees spawn in appropriate biomes

---

## Phase 3 — Game Systems

**Goal**: Full inventory, crafting, and survival mechanics.

### Deliverables
- [x] 36-slot inventory (27 main + 9 hotbar)
- [x] Crafting grid (3×3) with recipe matching
- [x] Furnace with smelting recipes
- [x] Crafting recipes (tools, armor, blocks, materials)
- [x] Health and hunger bars (UI display + game logic)
- [x] Fall damage, drowning, starvation
- [x] Tool system (5 materials × 4 tools = 20 tools)
- [x] Item drops when blocks break
- [x] Armor system (iron + diamond, 4 slots)
- [x] Food system (apple, bread, steak, porkchop)
- [x] IndexedDB save/load system (auto-save every 60s)
- [x] E key opens inventory UI
- [x] Number keys 1-9 for hotbar selection

### Acceptance Criteria
- Player can craft all basic tools and items
- Furnace smelts ores into ingots
- Health/hunger system works
- Game state persists across sessions

---

## Phase 4 — Content Expansion

**Goal**: Add life, danger, and advanced mechanics.

### Deliverables
- [x] Day/night cycle with dynamic lighting (sun/moon positions, ambient color)
- [x] Hostile mobs (zombie, skeleton, creeper, spider)
- [x] Passive mobs (cow, pig, sheep, chicken)
- [x] Mob spawning by light level + time of day
- [x] Mob AI: chase (hostile), wander (passive), jump over obstacles
- [x] Combat system with sword damage + knockback
- [x] Water and lava fluid simulation (flow + water+lava=cobblestone)
- [x] Particle effects (block break, damage, mob death)
- [x] Mob drops on death
- [ ] Redstone circuit basics (wire, torch, repeater, piston)
- [ ] Nether portal and Nether dimension
- [ ] End portal and Ender Dragon
- [ ] Sound effects and ambient music
- [ ] Weather (rain, snow, thunder)

---

## Directory Structure

```
mc/
├── docs/
│   ├── PROJECT_PLAN.md      ← this file
│   └── ARCHITECTURE.md      ← technical architecture
├── public/
│   └── textures/            ← block textures (16×16 PNGs)
├── src/
│   ├── main.tsx             ← entry point
│   ├── App.tsx              ← root React component
│   ├── engine/
│   │   ├── Game.ts          ← main game loop
│   │   ├── Renderer.ts      ← Three.js scene setup
│   │   ├── InputManager.ts  ← keyboard/mouse input
│   │   └── TextureAtlas.ts  ← block texture management
│   ├── world/
│   │   ├── Chunk.ts         ← single chunk data + mesh
│   │   ├── ChunkManager.ts  ← chunk loading/unloading
│   │   ├── World.ts         ← world state, block get/set
│   │   ├── WorldGen.ts      ← terrain generation
│   │   ├── Biome.ts         ← biome definitions
│   │   ├── GreedyMesher.ts  ← mesh optimization
│   │   └── BlockRegistry.ts ← block type definitions
│   ├── player/
│   │   ├── Player.ts        ← player entity + physics
│   │   ├── PlayerController.ts ← input → movement
│   │   └── Inventory.ts     ← item storage
│   ├── ui/
│   │   ├── HUD.tsx          ← health, hunger, hotbar
│   │   ├── InventoryUI.tsx  ← full inventory screen
│   │   ├── CraftingUI.tsx   ← crafting grid
│   │   └── DebugOverlay.tsx ← FPS, coords, chunk info
│   ├── systems/
│   │   ├── PhysicsSystem.ts ← collision detection
│   │   ├── LightingSystem.ts← block light propagation
│   │   ├── MobSystem.ts     ← mob AI and spawning
│   │   ├── FluidSystem.ts   ← water/lava simulation
│   │   └── SaveSystem.ts    ← IndexedDB persistence
│   ├── types/
│   │   └── index.ts         ← shared TypeScript types
│   └── constants.ts         ← game constants
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

## Key Constants

```
CHUNK_SIZE = 16 (width) × 256 (height) × 16 (depth)
BLOCK_SIZE = 1 (unit)
RENDER_DISTANCE = 8 chunks
SEA_LEVEL = 62
WORLD_HEIGHT = 256
TICK_RATE = 20 ticks/second
```

## How to Continue Development

1. Read `docs/ARCHITECTURE.md` for technical details
2. Check `src/constants.ts` for game constants
3. Each module is self-contained — read the file header for its purpose
4. Run `npm run dev` to start development server
5. Run `npm run build` to verify no TypeScript errors
