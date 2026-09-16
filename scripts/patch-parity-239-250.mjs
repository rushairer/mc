import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`patch produced no change: ${path}`);
  writeFileSync(path, after);
}

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`missing patch anchor: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`ambiguous patch anchor: ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

patch('src/world/WildernessBoundChanges26_3.ts', source => replaceOnce(
  source,
  `export function shouldPrioritizeShieldUse26_3(\n  mainHandName: string | undefined,\n  offhandName: string | undefined,\n): boolean {\n  return offhandName === 'shield'\n    && !!mainHandName\n    && (mainHandName.endsWith('_hoe') || mainHandName.endsWith('_shovel'));\n}`,
  `export function shouldPrioritizeShieldUse26_3(\n  mainHandName: string | undefined,\n  offhandName: string | undefined,\n): boolean {\n  const isTool = (name: string | undefined) =>\n    !!name && (name.endsWith('_hoe') || name.endsWith('_shovel'));\n  return (mainHandName === 'shield' && isTool(offhandName))\n    || (offhandName === 'shield' && isTool(mainHandName));\n}`,
  'symmetric shield priority',
));

patch('src/entities/Mob.ts', source => {
  let out = replaceOnce(
    source,
    `import type { VillagerProfession } from '../systems/VillageSystem';`,
    `import type { VillagerProfession } from '../systems/VillageSystem';\nimport { shouldRunRandomMovement26_3 } from '../world/WildernessBoundChanges26_3';`,
    'Mob import',
  );
  out = replaceOnce(
    out,
    `    onShoot?: (origin: THREE.Vector3, direction: THREE.Vector3, type: 'arrow' | 'fireball' | 'potion' | 'shulker_bullet' | 'wither_skull') => void,\n    playerHeldItem = 0,\n    playerLookDir?: THREE.Vector3\n  ) {`,
    `    onShoot?: (origin: THREE.Vector3, direction: THREE.Vector3, type: 'arrow' | 'fireball' | 'potion' | 'shulker_bullet' | 'wither_skull') => void,\n    playerHeldItem = 0,\n    playerLookDir?: THREE.Vector3,\n    randomMovementPlayerNearby = true\n  ) {`,
    'Mob update parameter',
  );
  out = replaceOnce(
    out,
    `      this.updateAI(dt, playerPos, getBlock, fluidState.inWater, gameMode, playerHeldItem);`,
    `      this.updateAI(dt, playerPos, getBlock, fluidState.inWater, gameMode, playerHeldItem, randomMovementPlayerNearby);`,
    'Mob updateAI call',
  );
  out = replaceOnce(
    out,
    `  private updateAI(\n    dt: number,\n    playerPos: THREE.Vector3,\n    getBlock: (x: number, y: number, z: number) => number,\n    inWater: boolean,\n    gameMode: 'survival' | 'creative' = 'survival',\n    playerHeldItem = 0\n  ) {`,
    `  private updateAI(\n    dt: number,\n    playerPos: THREE.Vector3,\n    getBlock: (x: number, y: number, z: number) => number,\n    inWater: boolean,\n    gameMode: 'survival' | 'creative' = 'survival',\n    playerHeldItem = 0,\n    randomMovementPlayerNearby = true\n  ) {`,
    'Mob updateAI parameter',
  );
  out = replaceOnce(
    out,
    `      } else {\n        this.wander(dt, getBlock);\n      }\n    }\n  }\n\n  private wander`,
    `      } else if (shouldRunRandomMovement26_3(randomMovementPlayerNearby)) {\n        this.wander(dt, getBlock);\n      } else {\n        this.aiState = 'idle';\n        this.wanderTarget = null;\n        this.velocity.x *= 0.8;\n        this.velocity.z *= 0.8;\n      }\n    }\n  }\n\n  private wander`,
    'Mob remote wander gate',
  );
  return out;
});

patch('src/systems/MobSystem.ts', source => {
  let out = replaceOnce(
    source,
    `const DESPAWN_RANGE = 80;\nconst BREEDABLE_TYPES`,
    `const DESPAWN_RANGE = 80;\n// Internal activation radius for 26.3 random walk/swim goals. Targeted AI still runs outside it.\nexport const RANDOM_MOVEMENT_PLAYER_RANGE_26_3 = 32;\nconst BREEDABLE_TYPES`,
    'MobSystem activation constant',
  );
  out = replaceOnce(
    out,
    `      }, playerHeldItem, playerLookDir);`,
    `      }, playerHeldItem, playerLookDir, mob.position.distanceTo(playerPos) <= RANDOM_MOVEMENT_PLAYER_RANGE_26_3);`,
    'MobSystem update call',
  );
  return out;
});

patch('src/engine/Game.ts', source => {
  let out = replaceOnce(
    source,
    `import { planBlockPlacement } from '../world/BlockPlacement';`,
    `import { planBlockPlacement } from '../world/BlockPlacement';\nimport { shouldPrioritizeShieldUse26_3 } from '../world/WildernessBoundChanges26_3';`,
    'Game shield-priority import',
  );
  out = replaceOnce(
    out,
    `      if (blockBehaviorResult?.handled) {\n        this.placeCooldown = blockBehaviorResult.cooldown ?? 0.25;\n        return;\n      }\n\n      if (selectedSlot && heldItemDef) {`,
    `      if (blockBehaviorResult?.handled) {\n        this.placeCooldown = blockBehaviorResult.cooldown ?? 0.25;\n        return;\n      }\n\n      const offhandStack = this.inventory.getOffhand();\n      const offhandName = offhandStack ? ItemRegistry.get(offhandStack.id)?.name : undefined;\n      if (\n        this.isShieldBlocking\n        && shouldPrioritizeShieldUse26_3(heldItemDef?.name, offhandName)\n      ) {\n        // Java 26.3: raising a shield wins over Hoe/Shovel item-on-block actions.\n        this.placeCooldown = 0.05;\n        return;\n      }\n\n      if (selectedSlot && heldItemDef) {`,
    'Game right-click shield priority',
  );
  return out;
});

patch('src/world/WildernessBoundGameplay26_3.ts', source => source
  .replace(`soundEvent?: 'block.shelf_mushroom.fall';`, `soundEvent?: 'block.shelf_mushroom.bounce';`)
  .replace(`soundEvent: 'block.shelf_mushroom.fall',`, `soundEvent: 'block.shelf_mushroom.bounce',`));

patch('tests/parity-211-230.test.ts', source => {
  const before = source;
  const after = source.replaceAll(`'block.shelf_mushroom.fall'`, `'block.shelf_mushroom.bounce'`);
  if (after === before) throw new Error('missing shelf mushroom bounce fixture');
  return after;
});

writeFileSync('tests/parity-239-250.test.ts', `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyShelfMushroomBounce26_3 } from '../src/world/WildernessBoundGameplay26_3';
import {
  CUSHION_SOUNDS_26_3,
  POPLAR_LEAVES_SOUNDS_26_3,
  RED_SHRUB_SOUNDS_26_3,
  SHELF_MUSHROOM_SOUNDS_26_3,
  STRAW_BED_SOUNDS_26_3,
  fallingLeafParticle26_3,
  levelUpVillagerTrades26_3,
  shouldPrioritizeShieldUse26_3,
  shouldRunRandomMovement26_3,
} from '../src/world/WildernessBoundChanges26_3';
import { RANDOM_MOVEMENT_PLAYER_RANGE_26_3 } from '../src/systems/MobSystem';

test('239: random movement only runs while a player is nearby', () => {
  assert.equal(shouldRunRandomMovement26_3(true), true);
  assert.equal(shouldRunRandomMovement26_3(false), false);
});

test('240: live MobSystem passes a bounded player-nearby activation signal into Mob AI', () => {
  assert.equal(RANDOM_MOVEMENT_PLAYER_RANGE_26_3, 32);
  const mobSource = readFileSync('src/entities/Mob.ts', 'utf8');
  const systemSource = readFileSync('src/systems/MobSystem.ts', 'utf8');
  assert.match(mobSource, /shouldRunRandomMovement26_3\\(randomMovementPlayerNearby\\)/);
  assert.match(systemSource, /RANDOM_MOVEMENT_PLAYER_RANGE_26_3/);
});

test('241: offhand shield takes priority over a main-hand hoe', () => {
  assert.equal(shouldPrioritizeShieldUse26_3('diamond_hoe', 'shield'), true);
  assert.equal(shouldPrioritizeShieldUse26_3('shield', 'diamond_hoe'), true);
});

test('242: offhand shield takes priority over a main-hand shovel', () => {
  assert.equal(shouldPrioritizeShieldUse26_3('netherite_shovel', 'shield'), true);
  assert.equal(shouldPrioritizeShieldUse26_3('shield', 'netherite_shovel'), true);
});

test('243: shield priority does not swallow unrelated item use', () => {
  assert.equal(shouldPrioritizeShieldUse26_3('diamond_sword', 'shield'), false);
  assert.equal(shouldPrioritizeShieldUse26_3('diamond_hoe', 'totem_of_undying'), false);
});

test('244: Spruce Leaves no longer emit falling leaf particles in 26.3', () => {
  assert.equal(fallingLeafParticle26_3('spruce_leaves'), null);
});

test('245: all three Poplar leaf colors expose distinct falling leaf particles', () => {
  assert.equal(fallingLeafParticle26_3('red_poplar_leaves'), 'minecraft:red_poplar_leaves');
  assert.equal(fallingLeafParticle26_3('orange_poplar_leaves'), 'minecraft:orange_poplar_leaves');
  assert.equal(fallingLeafParticle26_3('yellow_poplar_leaves'), 'minecraft:yellow_poplar_leaves');
});

test('246: Poplar Leaves sound family contains ambient, fall and hit events', () => {
  assert.ok(POPLAR_LEAVES_SOUNDS_26_3.includes('block.poplar_leaves.ambient'));
  assert.ok(POPLAR_LEAVES_SOUNDS_26_3.includes('block.poplar_leaves.fall'));
  assert.ok(POPLAR_LEAVES_SOUNDS_26_3.includes('block.poplar_leaves.hit'));
});

test('247: Shelf Mushroom bounce uses the dedicated 26.3 bounce sound', () => {
  assert.ok(SHELF_MUSHROOM_SOUNDS_26_3.includes('block.shelf_mushroom.bounce'));
  assert.equal(applyShelfMushroomBounce26_3(-8, false).soundEvent, 'block.shelf_mushroom.bounce');
});

test('248: Straw Bed and Red Shrub expose their dedicated 26.3 sound sets', () => {
  assert.ok(STRAW_BED_SOUNDS_26_3.includes('block.straw_bed.break_leave'));
  assert.ok(RED_SHRUB_SOUNDS_26_3.includes('block.red_shrub.place'));
});

test('249: Cushion interaction sounds include sit and get-up lifecycle events', () => {
  assert.ok(CUSHION_SOUNDS_26_3.includes('entity.cushion.sit'));
  assert.ok(CUSHION_SOUNDS_26_3.includes('entity.cushion.get_up'));
});

test('250: villager level-up offers request a live open-screen refresh exactly once per level advance', () => {
  const initial = { level: 2, revision: 7 };
  const advanced = levelUpVillagerTrades26_3(initial, 3);
  assert.deepEqual(advanced.state, { level: 3, revision: 8 });
  assert.equal(advanced.refreshOpenTradingUi, true);
  const unchanged = levelUpVillagerTrades26_3(advanced.state, 3);
  assert.deepEqual(unchanged.state, { level: 3, revision: 8 });
  assert.equal(unchanged.refreshOpenTradingUi, false);
});
`);

console.log('Applied parity 239-250 runtime and regression patches.');
