import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (path, before, after) => {
  const source = read(path);
  if (!source.includes(before)) throw new Error(`Missing patch anchor in ${path}: ${before.slice(0, 100)}`);
  write(path, source.replace(before, after));
};

write('src/world/OpenableRules.ts', `import type { BlockFacing, BlockMetadata } from '../types';

export type OpenableKind = 'door' | 'trapdoor' | 'fence_gate';

const normalize = (rawName: string) => rawName.toLowerCase().replace(/^minecraft:/, '');

export function getOpenableKind(rawName: string): OpenableKind | undefined {
  const name = normalize(rawName);
  if (name.includes('trapdoor')) return 'trapdoor';
  if (name.includes('fence_gate')) return 'fence_gate';
  if (name === 'door' || name === 'wooden_door' || name === 'iron_door' || name.endsWith('_door')) return 'door';
  return undefined;
}

/** Iron doors/trapdoors are redstone-only; other vanilla openables can be used by hand. */
export function canHandToggleOpenable(rawName: string): boolean {
  const name = normalize(rawName);
  const kind = getOpenableKind(name);
  if (!kind) return false;
  return name !== 'iron_door' && name !== 'iron_trapdoor';
}

export interface OpenableRedstoneState {
  changed: boolean;
  open: boolean;
  powered: boolean;
}

/**
 * Java openables only force their open state when the redstone-powered state
 * transitions. Re-evaluating an already-unpowered block must not erase a
 * player's manual open/closed choice.
 */
export function resolveOpenableRedstoneState(
  metadata: Pick<BlockMetadata, 'open' | 'powered'> | undefined,
  poweredNow: boolean,
): OpenableRedstoneState {
  const previousPowered = metadata?.powered ?? false;
  const currentOpen = metadata?.open ?? false;
  if (previousPowered === poweredNow) {
    return { changed: false, open: currentOpen, powered: previousPowered };
  }
  return { changed: true, open: poweredNow, powered: poweredNow };
}

const horizontalFacing = (facing: BlockFacing | undefined): Exclude<BlockFacing, 'up' | 'down'> =>
  facing === 'south' || facing === 'east' || facing === 'west' ? facing : 'north';

const opposite: Record<Exclude<BlockFacing, 'up' | 'down'>, Exclude<BlockFacing, 'up' | 'down'>> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

export interface FenceGateManualState {
  open: boolean;
  facing: Exclude<BlockFacing, 'up' | 'down'>;
}

/**
 * Opening a fence gate from its back flips the facing to the player's direction
 * so the gate opens away from the player, matching Java's FenceGateBlock use rule.
 */
export function resolveFenceGateManualToggle(
  metadata: Pick<BlockMetadata, 'open' | 'facing'> | undefined,
  playerFacing: BlockFacing,
): FenceGateManualState {
  const currentFacing = horizontalFacing(metadata?.facing);
  if (metadata?.open) return { open: false, facing: currentFacing };
  const playerHorizontal = horizontalFacing(playerFacing);
  return {
    open: true,
    facing: currentFacing === opposite[playerHorizontal] ? playerHorizontal : currentFacing,
  };
}
`);

write('src/world/ContainerRules.ts', `import type { BlockDef } from '../types';

/**
 * Chest lids are blocked by an opaque full/solid block above them. Barrels do
 * not use this rule. Transparent solid blocks such as glass are intentionally
 * not treated as lid blockers.
 */
export function isChestObstructingBlock(block: BlockDef | undefined): boolean {
  return !!block && block.solid && !block.transparent;
}

/**
 * Degrees are the number of other horizontal chest neighbors already touching
 * each chest adjacent to the placement target. Java allows one new partner but
 * rejects triple/corner chest formation.
 */
export function canPlaceChestFromNeighborDegrees(neighborDegrees: readonly number[]): boolean {
  if (neighborDegrees.length > 1) return false;
  return neighborDegrees.length === 0 || neighborDegrees[0] === 0;
}
`);

write('src/world/FurnaceRules.ts', `import type { ItemStack } from '../types';

export type FurnaceKind = 'furnace' | 'smoker' | 'blast_furnace';

/** Smokers and blast furnaces process valid recipes at twice furnace speed. */
export function getFurnaceCookSpeed(kind: FurnaceKind | string | undefined): number {
  return kind === 'smoker' || kind === 'blast_furnace' ? 2 : 1;
}

export function canAcceptFurnaceOutput(
  output: ItemStack | null | undefined,
  resultItemId: number,
  resultCount: number,
  maxStackSize: number,
): boolean {
  if (!output) return resultCount <= maxStackSize;
  return output.id === resultItemId && output.count + resultCount <= maxStackSize;
}

/** Empty bucket in the fuel slot collects the water released by a wet sponge. */
export function getWetSpongeFuelRemainder(
  inputName: string | undefined,
  fuelSlot: ItemStack | null | undefined,
): ItemStack | undefined {
  if (inputName !== 'wet_sponge' || fuelSlot?.id !== 325) return undefined;
  return { id: 326, count: 1 };
}
`);

write('src/world/BedRules.ts', `import type { BlockFacing, BlockMetadata } from '../types';

export type BedDimension = 'overworld' | 'nether' | 'end';

export interface BedUseDecision {
  canSleep: boolean;
  setsSpawn: boolean;
  explodes: boolean;
  blockedByMonsters: boolean;
}

/** Base Java bed dimension/time/safety contract. */
export function resolveBedUse(
  dimension: BedDimension,
  canSleepNow: boolean,
  monstersNearby = false,
): BedUseDecision {
  if (dimension !== 'overworld') {
    return { canSleep: false, setsSpawn: false, explodes: true, blockedByMonsters: false };
  }
  const blockedByMonsters = canSleepNow && monstersNearby;
  return {
    canSleep: canSleepNow && !monstersNearby,
    setsSpawn: !blockedByMonsters,
    explodes: false,
    blockedByMonsters,
  };
}

export interface BedPosition { x: number; y: number; z: number }

function horizontalOffset(facing: BlockFacing | undefined): { x: number; z: number } {
  switch (facing) {
    case 'east': return { x: 1, z: 0 };
    case 'west': return { x: -1, z: 0 };
    case 'south': return { x: 0, z: 1 };
    case 'north':
    default: return { x: 0, z: -1 };
  }
}

/** Return the head block regardless of whether the player clicked head or foot. */
export function getBedHeadPosition(position: BedPosition, metadata: Pick<BlockMetadata, 'facing' | 'bedPart'> | undefined): BedPosition {
  if (metadata?.bedPart === 'head') return { ...position };
  const offset = horizontalOffset(metadata?.facing);
  return { x: position.x + offset.x, y: position.y, z: position.z + offset.z };
}

/** Java sleep safety box: 8 blocks horizontally and 5 vertically from the bed. */
export function isMonsterWithinBedSleepRange(bed: BedPosition, monster: BedPosition): boolean {
  return Math.abs(monster.x - bed.x) <= 8
    && Math.abs(monster.z - bed.z) <= 8
    && Math.abs(monster.y - bed.y) <= 5;
}
`);

replaceOnce(
  'src/world/BehaviorIds.ts',
  "  if (name.includes('trapdoor') && name !== 'iron_trapdoor') return 'minecraft:trapdoor';",
  "  if (name === 'iron_trapdoor') return 'minecraft:iron_trapdoor';\n  if (name.includes('trapdoor')) return 'minecraft:trapdoor';",
);

replaceOnce(
  'src/items/SmeltingRecipes.ts',
  "export interface SmeltingRecipe {",
  "import { ItemRegistry } from './ItemRegistry';\n\nexport interface SmeltingRecipe {",
);
replaceOnce(
  'src/items/SmeltingRecipes.ts',
  `export function findSmeltingResult(inputId: number): SmeltingRecipe | null {
  // Support matching by packed ID first
  const exactMatch = SMELTING_RECIPES.find(r => r.input === inputId);
  if (exactMatch) return exactMatch;

  // Fallback: match by base ID
  const baseId = inputId & 0x3FF;
  const baseMatch = SMELTING_RECIPES.find(r => (r.input & 0x3FF) === baseId);
  return baseMatch ?? null;
}`,
  `export function findSmeltingResult(inputId: number): SmeltingRecipe | null {
  const semanticInput = ItemRegistry.get(inputId);
  if (semanticInput?.name === 'wet_sponge') {
    const sponge = ItemRegistry.getByName('sponge');
    if (sponge) return { input: inputId, output: sponge.id, outputCount: 1, xp: 0.15, cookTime: 10 };
  }

  // Support matching by packed ID first
  const exactMatch = SMELTING_RECIPES.find(r => r.input === inputId);
  if (exactMatch) return exactMatch;

  // Legacy fallback only. Modern runtime IDs must not alias legacy recipes.
  if (semanticInput && semanticInput.baseId >= 256) return null;
  const baseId = inputId & 0x3FF;
  const baseMatch = SMELTING_RECIPES.find(r => (r.input & 0x3FF) === baseId);
  return baseMatch ?? null;
}`,
);
replaceOnce(
  'src/items/SmeltingRecipes.ts',
  `export function isSmeltingFuel(itemId: number): boolean {
  const baseId = itemId & 0x3FF;

  // Coal, charcoal
  if (baseId === 263) return true;
  // Planks
  if (baseId === 5) return true;
  // Logs / Wood
  if (baseId === 17 || baseId === 162) return true;
  // Block of coal
  if (baseId === 173) return true;
  // Stick
  if (baseId === 280) return true;
  // Lava bucket
  if (baseId === 327) return true;
  // Chest, Crafting Table
  if (baseId === 54 || baseId === 58) return true;
  // Sapling
  if (baseId === 6) return true;
  // Wooden tools (sword, shovel, pickaxe, axe, hoe)
  if (baseId === 268 || baseId === 269 || baseId === 270 || baseId === 271 || baseId === 290) return true;
  // Bow, fishing rod
  if (baseId === 261 || baseId === 346) return true;

  return false;
}

export function getFuelBurnTime(itemId: number): number {
  const baseId = itemId & 0x3FF;
  if (baseId === 327) return 1000; // lava bucket
  if (baseId === 173) return 800;  // coal block
  if (baseId === 263) return 80;   // coal/charcoal
  if (baseId === 17 || baseId === 162 || baseId === 5 || baseId === 54 || baseId === 58) return 15; // logs, planks, chest, crafting table
  if (baseId === 268 || baseId === 269 || baseId === 270 || baseId === 271 || baseId === 290 || baseId === 261 || baseId === 346) return 10; // wooden tools/weapons
  if (baseId === 280 || baseId === 6) return 5; // stick, sapling
  return 0;
}`,
  `const OVERWORLD_WOOD_PREFIXES = [
  'oak_', 'spruce_', 'birch_', 'jungle_', 'acacia_', 'dark_oak_', 'mangrove_',
  'cherry_', 'pale_oak_', 'poplar_', 'bamboo_',
] as const;

function isOverworldWoodName(name: string): boolean {
  return OVERWORLD_WOOD_PREFIXES.some(prefix => name.startsWith(prefix));
}

function getSemanticFuelBurnTime(itemId: number): number {
  const item = ItemRegistry.get(itemId);
  if (!item) return 0;
  const name = item.name;

  if (name === 'lava_bucket') return 1000;
  if (name === 'coal_block') return 800;
  if (name === 'dried_kelp_block') return 200;
  if (name === 'blaze_rod') return 120;
  if (name === 'coal' || name === 'charcoal') return 80;
  if (name.includes('boat') || name.includes('raft')) return 60;
  if (isOverworldWoodName(name) && name.endsWith('_hanging_sign')) return 40;

  if (item.toolMaterial === 'wood') return 10;
  if (isOverworldWoodName(name)) {
    if (name.endsWith('_door') && !name.includes('trapdoor')) return 10;
    if (name.endsWith('_sign') && !name.endsWith('_hanging_sign')) return 10;
    if (name.endsWith('_slab')) return 7.5;
    if (name.endsWith('_button') || name.endsWith('_sapling')) return 5;
    if (
      name.includes('log') || name.endsWith('_wood') || name.includes('planks') ||
      name.endsWith('_stairs') || name.includes('trapdoor') || name.includes('pressure_plate') ||
      name.includes('fence') || name.includes('shelf')
    ) return 15;
  }
  if (name === 'stick' || name === 'bowl' || name === 'dead_bush') return 5;
  if (name === 'bow' || name === 'fishing_rod') return 10;
  if (name === 'chest' || name === 'trapped_chest' || name === 'crafting_table' || name === 'bookshelf' || name === 'note_block') return 15;
  return 0;
}

export function isSmeltingFuel(itemId: number): boolean {
  return getFuelBurnTime(itemId) > 0;
}

export function getFuelBurnTime(itemId: number): number {
  const semanticTime = getSemanticFuelBurnTime(itemId);
  if (semanticTime > 0) return semanticTime;

  const item = ItemRegistry.get(itemId);
  if (item && item.baseId >= 256) return 0;

  const baseId = itemId & 0x3FF;
  if (baseId === 327) return 1000;
  if (baseId === 173) return 800;
  if (baseId === 263) return 80;
  if (baseId === 17 || baseId === 162 || baseId === 5 || baseId === 54 || baseId === 58) return 15;
  if (baseId === 268 || baseId === 269 || baseId === 270 || baseId === 271 || baseId === 290 || baseId === 261 || baseId === 346) return 10;
  if (baseId === 280 || baseId === 6) return 5;
  return 0;
}`,
);

replaceOnce(
  'src/world/SignRules.ts',
  `  if (itemName === 'glow_ink_sac') {
    return {
      handled: true,
      opensEditor: false,
      consumeItem: true,
      metadata: side === 'front' ? { ...next, signGlowingFront: true } : { ...next, signGlowingBack: true },
    };
  }`,
  `  if (itemName === 'glow_ink_sac') {
    const lines = getSignTextForSide(next, side);
    const alreadyGlowing = side === 'front' ? next.signGlowingFront : next.signGlowingBack;
    if (alreadyGlowing || lines.every(line => line.length === 0)) {
      return { handled: true, opensEditor: true, consumeItem: false, metadata: next };
    }
    return {
      handled: true,
      opensEditor: false,
      consumeItem: true,
      metadata: side === 'front' ? { ...next, signGlowingFront: true } : { ...next, signGlowingBack: true },
    };
  }`,
);
replaceOnce(
  'src/world/SignRules.ts',
  `  if (itemName === 'ink_sac') {
    return {
      handled: true,
      opensEditor: false,
      consumeItem: true,
      metadata: side === 'front' ? { ...next, signGlowingFront: false } : { ...next, signGlowingBack: false },
    };
  }`,
  `  if (itemName === 'ink_sac') {
    const alreadyPlain = side === 'front' ? !next.signGlowingFront : !next.signGlowingBack;
    if (alreadyPlain) return { handled: true, opensEditor: true, consumeItem: false, metadata: next };
    return {
      handled: true,
      opensEditor: false,
      consumeItem: true,
      metadata: side === 'front' ? { ...next, signGlowingFront: false } : { ...next, signGlowingBack: false },
    };
  }`,
);

replaceOnce(
  'src/engine/Game.ts',
  "import { resolveOpenableRedstoneState } from '../world/OpenableRules';\nimport { isChestObstructingBlock } from '../world/ContainerRules';\nimport { getFurnaceCookSpeed } from '../world/FurnaceRules';\nimport { resolveBedUse } from '../world/BedRules';",
  "import { resolveFenceGateManualToggle, resolveOpenableRedstoneState } from '../world/OpenableRules';\nimport { canPlaceChestFromNeighborDegrees, isChestObstructingBlock } from '../world/ContainerRules';\nimport { canAcceptFurnaceOutput, getFurnaceCookSpeed, getWetSpongeFuelRemainder } from '../world/FurnaceRules';\nimport { getBedHeadPosition, isMonsterWithinBedSleepRange, resolveBedUse } from '../world/BedRules';",
);
replaceOnce(
  'src/engine/Game.ts',
  `    this.behaviors.registerBlock([], {
      id: 'minecraft:iron_door',
      preventsItemUse: true,
      interact: () => ({ handled: true, cooldown: 0.25 }), // iron doors cannot be hand-opened
    });`,
  `    this.behaviors.registerBlock([], {
      id: 'minecraft:iron_door',
      preventsItemUse: true,
      interact: () => ({ handled: true, cooldown: 0.25 }), // iron doors cannot be hand-opened
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:iron_trapdoor',
      preventsItemUse: true,
      interact: () => ({ handled: true, cooldown: 0.25 }), // iron trapdoors are redstone-only too
    });`,
);
replaceOnce(
  'src/engine/Game.ts',
  `    const { plan } = decision;
    const { x, y, z } = plan.position;
    if (this.isMultiplayerNetworkConnected()) {`,
  `    const { plan } = decision;
    const { x, y, z } = plan.position;
    if (BlockRegistry.get(plan.blockId)?.name === 'chest' && !this.canPlaceChestAt(x, y, z)) return false;
    if (this.isMultiplayerNetworkConnected()) {`,
);
replaceOnce(
  'src/engine/Game.ts',
  `  private isChestBlockedAt(x: number, y: number, z: number): boolean {
    const above = BlockRegistry.get(this.chunks.getBlock(x, y + 1, z));
    return isChestObstructingBlock(above);
  }

  openChestUI(x: number, y: number, z: number) {`,
  `  private isChestBlockedAt(x: number, y: number, z: number): boolean {
    const above = BlockRegistry.get(this.chunks.getBlock(x, y + 1, z));
    return isChestObstructingBlock(above);
  }

  private canPlaceChestAt(x: number, y: number, z: number): boolean {
    const directions: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const adjacentChestDegrees: number[] = [];
    for (const [dx, dz] of directions) {
      const nx = x + dx;
      const nz = z + dz;
      if (BlockRegistry.get(this.chunks.getBlock(nx, y, nz))?.name !== 'chest') continue;
      let degree = 0;
      for (const [odx, odz] of directions) {
        const ox = nx + odx;
        const oz = nz + odz;
        if (ox === x && oz === z) continue;
        if (BlockRegistry.get(this.chunks.getBlock(ox, y, oz))?.name === 'chest') degree++;
      }
      adjacentChestDegrees.push(degree);
    }
    return canPlaceChestFromNeighborDegrees(adjacentChestDegrees);
  }

  openChestUI(x: number, y: number, z: number) {`,
);
replaceOnce(
  'src/engine/Game.ts',
  `  private toggleFenceGate(x: number, y: number, z: number) {
    const meta = this.chunks.getBlockMeta(x, y, z);
    const open = !(meta?.open ?? false);
    this.chunks.setBlockMeta(x, y, z, { ...meta, open }, true);
    this.redstone.observeBlockChange(x, y, z);
  }`,
  `  private toggleFenceGate(x: number, y: number, z: number) {
    const meta = this.chunks.getBlockMeta(x, y, z);
    const next = resolveFenceGateManualToggle(meta, this.getPlayerHorizontalFacing());
    this.chunks.setBlockMeta(x, y, z, { ...meta, open: next.open, facing: next.facing }, true);
    this.redstone.observeBlockChange(x, y, z);
  }`,
);
replaceOnce(
  'src/engine/Game.ts',
  `        if (!output) {
          canCook = true;
        } else if (output.id === recipeOutputId && output.count + recipeOutputCount <= 64) {
          canCook = true;
        }`,
  `        canCook = canAcceptFurnaceOutput(
          output,
          recipeOutputId,
          recipeOutputCount,
          ItemRegistry.getMaxStackSize(recipeOutputId),
        );`,
);
replaceOnce(
  'src/engine/Game.ts',
  `        // Produce output
        if (!output) {
          meta.inventory[2] = { id: recipeOutputId, count: recipeOutputCount };
        } else {
          meta.inventory[2] = { ...output, count: output.count + recipeOutputCount };
        }

        metadataChanged = true;`,
  `        // Produce output
        if (!output) {
          meta.inventory[2] = { id: recipeOutputId, count: recipeOutputCount };
        } else {
          meta.inventory[2] = { ...output, count: output.count + recipeOutputCount };
        }

        const wetSpongeRemainder = getWetSpongeFuelRemainder(ItemRegistry.get(input.id)?.name, meta.inventory[1]);
        if (wetSpongeRemainder) meta.inventory[1] = wetSpongeRemainder;

        metadataChanged = true;`,
);
replaceOnce(
  'src/engine/Game.ts',
  `  private useBed(x: number, y: number, z: number) {
    const dimension = this.chunks.currentDimension === Dimension.Overworld
      ? 'overworld'
      : this.chunks.currentDimension === Dimension.Nether
        ? 'nether'
        : 'end';
    const outcome = resolveBedUse(dimension, this.isNight());

    if (outcome.explodes) {
      this.createExplosion(x + 0.5, y + 0.5, z + 0.5, 5);
      return;
    }

    if (outcome.setsSpawn) {
      this.bedSpawnPoint = new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
    }
    this.sound.playBlockPlace(35);

    if (outcome.canSleep) {
      this.advancements.checkSleep();
      this.gameTime = 0.0;
      this.addChatMessage('You are now sleeping. Morning has come.');
      this.notifyState();
    } else {
      this.addChatMessage('You can only sleep at night');
    }
  }`,
  `  private useBed(x: number, y: number, z: number) {
    const dimension = this.chunks.currentDimension === Dimension.Overworld
      ? 'overworld'
      : this.chunks.currentDimension === Dimension.Nether
        ? 'nether'
        : 'end';
    const metadata = this.chunks.getBlockMeta(x, y, z);
    const head = getBedHeadPosition({ x, y, z }, metadata);
    const canSleepNow = this.isNight() || this.weather.getCurrentWeather() === 'thunder';
    const monstersNearby = Array.from(this.mobs.mobs.values()).some((mob) =>
      mob.health > 0 && mob.def.hostile && isMonsterWithinBedSleepRange(head, mob.position),
    );
    const outcome = resolveBedUse(dimension, canSleepNow, monstersNearby);

    if (outcome.explodes) {
      this.createExplosion(head.x + 0.5, head.y + 0.5, head.z + 0.5, 5);
      return;
    }

    if (outcome.setsSpawn) {
      this.bedSpawnPoint = new THREE.Vector3(head.x + 0.5, head.y + 1, head.z + 0.5);
    }
    this.sound.playBlockPlace(35);

    if (outcome.canSleep) {
      this.advancements.checkSleep();
      this.gameTime = 0.0;
      if (this.weather.getCurrentWeather() !== 'clear') this.weather.setWeatherType('clear');
      this.addChatMessage('You are now sleeping. Morning has come.');
      this.notifyState();
    } else if (outcome.blockedByMonsters) {
      this.addChatMessage('You may not rest now; there are monsters nearby');
    } else {
      this.addChatMessage('You can only sleep at night or during thunderstorms');
    }
  }`,
);

replaceOnce(
  'tests/parity-351-370.test.ts',
  `test('364: glow ink applies glow to only the interacted side', () => {
  const result = applySignInteraction(undefined, 'glow_ink_sac', 'front');
  assert.equal(result.metadata.signGlowingFront, true);
  assert.equal(result.metadata.signGlowingBack, false);
});`,
  `test('364: glow ink applies glow to only the interacted side', () => {
  const sign = setSignTextForSide(undefined, 'front', ['hello']);
  const result = applySignInteraction(sign, 'glow_ink_sac', 'front');
  assert.equal(result.metadata.signGlowingFront, true);
  assert.equal(result.metadata.signGlowingBack, false);
});`,
);
replaceOnce(
  'tests/parity-351-370.test.ts',
  `  assert.deepEqual(resolveBedUse('overworld', true), { canSleep: true, setsSpawn: true, explodes: false });
  assert.deepEqual(resolveBedUse('overworld', false), { canSleep: false, setsSpawn: true, explodes: false });
  assert.deepEqual(resolveBedUse('nether', true), { canSleep: false, setsSpawn: false, explodes: true });
  assert.deepEqual(resolveBedUse('end', true), { canSleep: false, setsSpawn: false, explodes: true });
  const source = gameSource();
  assert.ok(source.includes('const outcome = resolveBedUse(dimension, this.isNight());'));
  assert.ok(source.includes('this.createExplosion(x + 0.5, y + 0.5, z + 0.5, 5);'));`,
  `  assert.deepEqual(resolveBedUse('overworld', true), { canSleep: true, setsSpawn: true, explodes: false, blockedByMonsters: false });
  assert.deepEqual(resolveBedUse('overworld', false), { canSleep: false, setsSpawn: true, explodes: false, blockedByMonsters: false });
  assert.deepEqual(resolveBedUse('nether', true), { canSleep: false, setsSpawn: false, explodes: true, blockedByMonsters: false });
  assert.deepEqual(resolveBedUse('end', true), { canSleep: false, setsSpawn: false, explodes: true, blockedByMonsters: false });
  const source = gameSource();
  assert.ok(source.includes("this.isNight() || this.weather.getCurrentWeather() === 'thunder'"));
  assert.ok(source.includes('this.createExplosion(head.x + 0.5, head.y + 0.5, head.z + 0.5, 5);'));`,
);

write('tests/parity-371-390.test.ts', `import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { inferBlockBehaviorId } from '../src/world/BehaviorIds';
import { canPlaceChestFromNeighborDegrees } from '../src/world/ContainerRules';
import { canAcceptFurnaceOutput, getWetSpongeFuelRemainder } from '../src/world/FurnaceRules';
import { canHandToggleOpenable, resolveFenceGateManualToggle } from '../src/world/OpenableRules';
import { getBedHeadPosition, isMonsterWithinBedSleepRange, resolveBedUse } from '../src/world/BedRules';
import { applySignInteraction, setSignTextForSide } from '../src/world/SignRules';
import { findSmeltingResult, getFuelBurnTime, isSmeltingFuel } from '../src/items/SmeltingRecipes';
import { getHopperInsertionSlots } from '../src/systems/HopperSystem';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();
const gameSource = () => readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};

test('371: iron trapdoor is a redstone-only behavior instead of falling through item use', () => {
  assert.equal(inferBlockBehaviorId('iron_trapdoor'), 'minecraft:iron_trapdoor');
  assert.equal(canHandToggleOpenable('iron_trapdoor'), false);
  assert.ok(gameSource().includes("id: 'minecraft:iron_trapdoor'"));
});

test('372: wooden and Poplar trapdoors remain hand-operable', () => {
  assert.equal(inferBlockBehaviorId('oak_trapdoor'), 'minecraft:trapdoor');
  assert.equal(inferBlockBehaviorId('poplar_trapdoor'), 'minecraft:trapdoor');
  assert.equal(canHandToggleOpenable('poplar_trapdoor'), true);
});

test('373: opening a fence gate from its back flips facing to the player', () => {
  assert.deepEqual(resolveFenceGateManualToggle({ open: false, facing: 'north' }, 'south'), { open: true, facing: 'south' });
  assert.ok(gameSource().includes('resolveFenceGateManualToggle(meta, this.getPlayerHorizontalFacing())'));
});

test('374: closing a fence gate preserves its current facing', () => {
  assert.deepEqual(resolveFenceGateManualToggle({ open: true, facing: 'east' }, 'west'), { open: false, facing: 'east' });
});

test('375: an isolated chest may connect to one unpaired adjacent chest', () => {
  assert.equal(canPlaceChestFromNeighborDegrees([]), true);
  assert.equal(canPlaceChestFromNeighborDegrees([0]), true);
  assert.ok(gameSource().includes('this.canPlaceChestAt(x, y, z)'));
});

test('376: a chest cannot connect to a neighbor that is already paired', () => {
  assert.equal(canPlaceChestFromNeighborDegrees([1]), false);
});

test('377: a chest cannot create a triple/corner chest between two neighbors', () => {
  assert.equal(canPlaceChestFromNeighborDegrees([0, 0]), false);
  assert.equal(canPlaceChestFromNeighborDegrees([1, 0]), false);
});

test('378: furnace output rejects a result that would exceed the item stack limit', () => {
  assert.equal(canAcceptFurnaceOutput({ id: 1, count: 63 }, 1, 2, 64), false);
  assert.equal(canAcceptFurnaceOutput({ id: 2, count: 1 }, 1, 1, 64), false);
});

test('379: furnace output may fill a matching stack exactly to its max', () => {
  assert.equal(canAcceptFurnaceOutput({ id: 1, count: 63 }, 1, 1, 64), true);
  assert.ok(gameSource().includes('ItemRegistry.getMaxStackSize(recipeOutputId)'));
});

test('380: Poplar logs are semantic furnace fuel despite modern runtime IDs', () => {
  assert.equal(getFuelBurnTime(item('poplar_log').id), 15);
  assert.equal(isSmeltingFuel(item('poplar_log').id), true);
});

test('381: Poplar planks are semantic furnace fuel', () => {
  assert.equal(getFuelBurnTime(item('poplar_planks').id), 15);
});

test('382: Poplar trapdoors use the wooden 1.5-item burn time', () => {
  assert.equal(getFuelBurnTime(item('poplar_trapdoor').id), 15);
});

test('383: Poplar signs distinguish normal and hanging-sign burn times', () => {
  assert.equal(getFuelBurnTime(item('poplar_sign').id), 10);
  assert.equal(getFuelBurnTime(item('poplar_hanging_sign').id), 40);
});

test('384: Poplar saplings and buttons use the half-item burn time', () => {
  assert.equal(getFuelBurnTime(item('poplar_sapling').id), 5);
  assert.equal(getFuelBurnTime(item('poplar_button').id), 5);
});

test('385: hopper side insertion recognizes modern Poplar fuel for a furnace', () => {
  const planks = { id: item('poplar_planks').id, count: 1 };
  assert.deepEqual(getHopperInsertionSlots('furnace', 'side', planks), [1]);
});

test('386: wet sponge has a semantic smelting recipe back to sponge', () => {
  const wet = ItemRegistry.getByName('wet_sponge');
  const dry = ItemRegistry.getByName('sponge');
  assert.ok(wet);
  assert.ok(dry);
  const recipe = findSmeltingResult(wet.id);
  assert.ok(recipe);
  assert.equal(recipe.output, dry.id);
});

test('387: wet sponge turns an empty fuel-slot bucket into a water bucket', () => {
  assert.deepEqual(getWetSpongeFuelRemainder('wet_sponge', { id: 325, count: 1 }), { id: 326, count: 1 });
  assert.equal(getWetSpongeFuelRemainder('wet_sponge', { id: 263, count: 1 }), undefined);
  assert.ok(gameSource().includes('getWetSpongeFuelRemainder(ItemRegistry.get(input.id)?.name, meta.inventory[1])'));
});

test('388: a daytime thunderstorm satisfies the bed sleep-time contract', () => {
  assert.deepEqual(resolveBedUse('overworld', true, false), {
    canSleep: true, setsSpawn: true, explodes: false, blockedByMonsters: false,
  });
  assert.ok(gameSource().includes("this.isNight() || this.weather.getCurrentWeather() === 'thunder'"));
  assert.ok(gameSource().includes("this.weather.setWeatherType('clear')"));
});

test('389: bed safety uses the Java 8x5 monster box and explosions resolve to the head', () => {
  const head = getBedHeadPosition({ x: 10, y: 64, z: 10 }, { facing: 'east', bedPart: 'foot' });
  assert.deepEqual(head, { x: 11, y: 64, z: 10 });
  assert.equal(isMonsterWithinBedSleepRange(head, { x: 19, y: 69, z: 18 }), true);
  assert.equal(isMonsterWithinBedSleepRange(head, { x: 20, y: 69, z: 18 }), false);
  assert.equal(resolveBedUse('overworld', true, true).blockedByMonsters, true);
  assert.equal(resolveBedUse('overworld', true, true).canSleep, false);
  assert.ok(gameSource().includes('this.createExplosion(head.x + 0.5, head.y + 0.5, head.z + 0.5, 5)'));
});

test('390: glow ink on an empty sign side is a no-op and is not consumed', () => {
  const empty = applySignInteraction(undefined, 'glow_ink_sac', 'front');
  assert.equal(empty.consumeItem, false);
  assert.equal(empty.metadata.signGlowingFront, false);
  assert.equal(empty.opensEditor, true);

  const text = setSignTextForSide(undefined, 'front', ['hello']);
  const glowing = applySignInteraction(text, 'glow_ink_sac', 'front');
  assert.equal(glowing.consumeItem, true);
  assert.equal(glowing.metadata.signGlowingFront, true);
});
`);

console.log('Applied parity 371-390 patch');
