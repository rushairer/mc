import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`patch produced no change: ${path}`);
  writeFileSync(path, after);
}

function once(source, from, to, label) {
  const i = source.indexOf(from);
  if (i < 0) throw new Error(`missing anchor: ${label}`);
  if (source.indexOf(from, i + from.length) >= 0) throw new Error(`ambiguous anchor: ${label}`);
  return source.slice(0, i) + to + source.slice(i + from.length);
}

patch('src/world/WildernessBoundGameplay26_3.ts', source => {
  let out = once(
    source,
    `import { ItemRegistry } from '../items/ItemRegistry';`,
    `import { ItemRegistry } from '../items/ItemRegistry';\nimport { BlockRegistry } from './BlockRegistry';`,
    'gameplay BlockRegistry import',
  );
  out = once(
    out,
    `export function applyShelfMushroomBounce26_3(incomingVerticalVelocity: number, sneaking = false): ShelfMushroomBounce26_3 {\n  if (sneaking || incomingVerticalVelocity >= 0) {\n    return { bounced: false, verticalVelocity: incomingVerticalVelocity };\n  }\n  // Beds/slime-style restitution: preserve a modest fraction of downward speed.\n  return {\n    bounced: true,\n    soundEvent: 'block.shelf_mushroom.bounce',\n    verticalVelocity: Math.abs(incomingVerticalVelocity) * 0.5,\n  };\n}`,
    `export function applyShelfMushroomBounce26_3(incomingVerticalVelocity: number, sneaking = false): ShelfMushroomBounce26_3 {\n  if (sneaking || incomingVerticalVelocity >= 0) {\n    return { bounced: false, verticalVelocity: incomingVerticalVelocity };\n  }\n  // Beds/slime-style restitution: preserve a modest fraction of downward speed.\n  return {\n    bounced: true,\n    soundEvent: 'block.shelf_mushroom.bounce',\n    verticalVelocity: Math.abs(incomingVerticalVelocity) * 0.5,\n  };\n}\n\nexport function isShelfMushroomBlockId26_3(blockId: number): boolean {\n  return BlockRegistry.get(blockId)?.name === 'shelf_mushroom';\n}\n\nexport function resolveShelfMushroomLanding26_3(\n  blockId: number,\n  incomingVerticalVelocity: number,\n  sneaking = false,\n): ShelfMushroomBounce26_3 & { supported: boolean } {\n  if (!isShelfMushroomBlockId26_3(blockId)) {\n    return { supported: false, bounced: false, verticalVelocity: incomingVerticalVelocity };\n  }\n  return { supported: true, ...applyShelfMushroomBounce26_3(incomingVerticalVelocity, sneaking) };\n}`,
    'shelf mushroom landing resolver',
  );
  return out;
});

patch('src/player/Player.ts', source => {
  let out = once(
    source,
    `import { VisualResolver } from '../visual/VisualResolver';`,
    `import { VisualResolver } from '../visual/VisualResolver';\nimport { resolveShelfMushroomLanding26_3 } from '../world/WildernessBoundGameplay26_3';`,
    'Player shelf import',
  );
  out = once(
    out,
    `  private lastArmorIds = [-1, -1, -1, -1];`,
    `  private lastArmorIds = [-1, -1, -1, -1];\n  private shelfMushroomBounceSound26_3: 'block.shelf_mushroom.bounce' | null = null;`,
    'Player shelf pending sound',
  );
  out = once(
    out,
    `  startSwing() {\n    if (this.swingProgress === 0) {\n      this.swingProgress = 0.01;\n    }\n  }`,
    `  startSwing() {\n    if (this.swingProgress === 0) {\n      this.swingProgress = 0.01;\n    }\n  }\n\n  consumeShelfMushroomBounceSound26_3(): 'block.shelf_mushroom.bounce' | null {\n    const eventName = this.shelfMushroomBounceSound26_3;\n    this.shelfMushroomBounceSound26_3 = null;\n    return eventName;\n  }`,
    'Player shelf sound consumer',
  );
  out = once(
    out,
    `    // Y axis\n    const prevY = this.position.y;\n    this.position.y += this.velocity.y * dt;\n    this.onGround = false;\n\n    if (this.checkCollision(chunks, ignoredBlocks)) {\n      if (this.velocity.y < 0) {\n        // Landing - snap to block top\n        this.position.y = Math.floor(prevY) + 0.001;\n        this.onGround = true;\n      } else {\n        this.position.y = prevY;\n      }\n      this.velocity.y = 0;\n    }`,
    `    // Y axis\n    const prevY = this.position.y;\n    this.position.y += this.velocity.y * dt;\n    this.onGround = false;\n\n    const resolvedShelfLanding = this.resolveShelfMushroomLanding26_3(prevY, chunks);\n    if (!resolvedShelfLanding && this.checkCollision(chunks, ignoredBlocks)) {\n      if (this.velocity.y < 0) {\n        // Landing - snap to block top\n        this.position.y = Math.floor(prevY) + 0.001;\n        this.onGround = true;\n      } else {\n        this.position.y = prevY;\n      }\n      this.velocity.y = 0;\n    }`,
    'Player Y collision shelf bridge',
  );
  out = once(
    out,
    `  public checkCollision(chunks: ChunkManager, ignoredBlocks?: Set<string>): boolean {`,
    `  private resolveShelfMushroomLanding26_3(prevY: number, chunks: ChunkManager): boolean {\n    if (this.velocity.y >= 0) return false;\n    const bx = Math.floor(this.position.x);\n    const bz = Math.floor(this.position.z);\n    const minY = Math.floor(this.position.y);\n    const maxY = Math.floor(prevY);\n\n    for (let by = maxY; by >= minY; by--) {\n      const topY = by + 1;\n      if (prevY < topY || this.position.y > topY) continue;\n      const landing = resolveShelfMushroomLanding26_3(\n        chunks.getBlock(bx, by, bz),\n        this.velocity.y,\n        this.isSneaking,\n      );\n      if (!landing.supported) continue;\n      this.position.y = topY + 0.001;\n      this.velocity.y = landing.bounced ? landing.verticalVelocity : 0;\n      this.onGround = !landing.bounced;\n      if (landing.soundEvent) this.shelfMushroomBounceSound26_3 = landing.soundEvent;\n      return true;\n    }\n    return false;\n  }\n\n  public checkCollision(chunks: ChunkManager, ignoredBlocks?: Set<string>): boolean {`,
    'Player shelf landing method',
  );
  return out;
});

patch('src/entities/Mob.ts', source => {
  let out = once(
    source,
    `import { shouldRunRandomMovement26_3 } from '../world/WildernessBoundChanges26_3';`,
    `import { shouldRunRandomMovement26_3 } from '../world/WildernessBoundChanges26_3';\nimport { resolveShelfMushroomLanding26_3 } from '../world/WildernessBoundGameplay26_3';`,
    'Mob shelf import',
  );
  out = once(
    out,
    `  swingTimer = 0;`,
    `  swingTimer = 0;\n  private shelfMushroomBounceSound26_3: 'block.shelf_mushroom.bounce' | null = null;`,
    'Mob shelf pending sound',
  );
  out = once(
    out,
    `  isAttractedBy(itemId: number): boolean {`,
    `  consumeShelfMushroomBounceSound26_3(): 'block.shelf_mushroom.bounce' | null {\n    const eventName = this.shelfMushroomBounceSound26_3;\n    this.shelfMushroomBounceSound26_3 = null;\n    return eventName;\n  }\n\n  isAttractedBy(itemId: number): boolean {`,
    'Mob shelf sound consumer',
  );
  out = once(
    out,
    `    // Y axis\n    const prevY = this.position.y;\n    this.position.y += this.velocity.y * dt;\n    this.onGround = false;\n\n    if (this.checkCollision(getBlock, isSolidBlock, ignoredBlocks)) {\n      if (this.velocity.y < 0) {\n        this.position.y = Math.floor(prevY) + 0.001;\n        this.onGround = true;\n      } else {\n        this.position.y = prevY;\n      }\n      this.velocity.y = 0;\n    }`,
    `    // Y axis\n    const prevY = this.position.y;\n    this.position.y += this.velocity.y * dt;\n    this.onGround = false;\n\n    const resolvedShelfLanding = this.resolveShelfMushroomLanding26_3(prevY, getBlock);\n    if (!resolvedShelfLanding && this.checkCollision(getBlock, isSolidBlock, ignoredBlocks)) {\n      if (this.velocity.y < 0) {\n        this.position.y = Math.floor(prevY) + 0.001;\n        this.onGround = true;\n      } else {\n        this.position.y = prevY;\n      }\n      this.velocity.y = 0;\n    }`,
    'Mob Y collision shelf bridge',
  );
  out = once(
    out,
    `  public checkCollision(\n    getBlock: (x: number, y: number, z: number) => number,`,
    `  private resolveShelfMushroomLanding26_3(\n    prevY: number,\n    getBlock: (x: number, y: number, z: number) => number,\n  ): boolean {\n    if (this.velocity.y >= 0) return false;\n    const bx = Math.floor(this.position.x);\n    const bz = Math.floor(this.position.z);\n    const minY = Math.floor(this.position.y);\n    const maxY = Math.floor(prevY);\n\n    for (let by = maxY; by >= minY; by--) {\n      const topY = by + 1;\n      if (prevY < topY || this.position.y > topY) continue;\n      const landing = resolveShelfMushroomLanding26_3(getBlock(bx, by, bz), this.velocity.y, false);\n      if (!landing.supported) continue;\n      this.position.y = topY + 0.001;\n      this.velocity.y = landing.verticalVelocity;\n      this.onGround = false;\n      if (landing.soundEvent) this.shelfMushroomBounceSound26_3 = landing.soundEvent;\n      return true;\n    }\n    return false;\n  }\n\n  public checkCollision(\n    getBlock: (x: number, y: number, z: number) => number,`,
    'Mob shelf landing method',
  );
  return out;
});

patch('src/systems/MobSystem.ts', source => {
  let out = once(
    source,
    `    onMobAmbientSound?: (mob: Mob, kind: 'idle') => void,\n  ) {`,
    `    onMobAmbientSound?: (mob: Mob, kind: 'idle') => void,\n    onMobBounceSound26_3?: (mob: Mob, eventName: 'block.shelf_mushroom.bounce') => void,\n  ) {`,
    'MobSystem bounce callback signature',
  );
  out = once(
    out,
    `      mob.update(dt, playerPos, getBlock, hurtPlayer, isSolidBlock, gameMode, (origin, dir, type) => {\n        if (onMobShoot) onMobShoot(origin, dir, type);\n      }, playerHeldItem, playerLookDir, mob.position.distanceTo(playerPos) <= RANDOM_MOVEMENT_PLAYER_RANGE_26_3);\n\n      // P4.3: ambient idle sounds for audible families near the player.`,
    `      mob.update(dt, playerPos, getBlock, hurtPlayer, isSolidBlock, gameMode, (origin, dir, type) => {\n        if (onMobShoot) onMobShoot(origin, dir, type);\n      }, playerHeldItem, playerLookDir, mob.position.distanceTo(playerPos) <= RANDOM_MOVEMENT_PLAYER_RANGE_26_3);\n\n      const shelfBounceEvent26_3 = mob.consumeShelfMushroomBounceSound26_3();\n      if (shelfBounceEvent26_3 && onMobBounceSound26_3) {\n        onMobBounceSound26_3(mob, shelfBounceEvent26_3);\n      }\n\n      // P4.3: ambient idle sounds for audible families near the player.`,
    'MobSystem bounce callback bridge',
  );
  return out;
});

patch('src/engine/Game.ts', source => {
  let out = once(
    source,
    `    }, this.chunks);\n\n    if (this.riddenMob) {`,
    `    }, this.chunks);\n\n    const playerShelfBounceEvent26_3 = this.player.consumeShelfMushroomBounceSound26_3();\n    if (playerShelfBounceEvent26_3) this.sound.playNamedEvent26_3(playerShelfBounceEvent26_3);\n\n    if (this.riddenMob) {`,
    'Game player shelf sound bridge',
  );
  out = once(
    out,
    `        (mob, kind) => {\n          if (kind === 'idle') {\n            this.sound.playMobSound(mob.def.type, 'idle');\n          }\n        },\n      );`,
    `        (mob, kind) => {\n          if (kind === 'idle') {\n            this.sound.playMobSound(mob.def.type, 'idle');\n          }\n        },\n        (_mob, eventName) => {\n          this.sound.playNamedEvent26_3(eventName);\n        },\n      );`,
    'Game mob shelf sound bridge',
  );
  return out;
});

patch('src/systems/VillageSystem.ts', source => {
  let out = once(
    source,
    `import type { Inventory } from '../player/Inventory';`,
    `import type { Inventory } from '../player/Inventory';\nimport { resolveWildernessBoundTraderTrades26_3 } from '../world/WildernessBoundGameplay26_3';`,
    'VillageSystem trader import',
  );
  out = once(
    out,
    `export interface TradeOffer {\n  id: string;\n  profession: VillagerProfession;\n  input: { id: number; count: number };\n  output: { id: number; count: number };\n}`,
    `export interface ExecutableTradeOffer {\n  id: string;\n  input: { id: number; count: number };\n  output: { id: number; count: number };\n}\n\nexport interface TradeOffer extends ExecutableTradeOffer {\n  profession: VillagerProfession;\n}\n\nexport interface WanderingTraderTradeOffer26_3 extends ExecutableTradeOffer {\n  profession: 'wandering_trader';\n}`,
    'VillageSystem executable trade type',
  );
  out = once(
    out,
    `  static performTrade(inventory: Inventory, offer: TradeOffer, creative = false): boolean {`,
    `  static getWanderingTraderOffers26_3(): WanderingTraderTradeOffer26_3[] {\n    return resolveWildernessBoundTraderTrades26_3().map(offer => ({\n      ...offer,\n      profession: 'wandering_trader' as const,\n    }));\n  }\n\n  static performTrade(inventory: Inventory, offer: ExecutableTradeOffer, creative = false): boolean {`,
    'VillageSystem wandering trader getter',
  );
  return out;
});

writeFileSync('tests/parity-271-280.test.ts', `import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { Player } from '../src/player/Player';
import { Inventory } from '../src/player/Inventory';
import { Mob } from '../src/entities/Mob';
import { MobSystem } from '../src/systems/MobSystem';
import { VillageSystem } from '../src/systems/VillageSystem';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { SHELF_MUSHROOM_BLOCK } from '../src/world/WildernessBound26_3';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';
import {
  isShelfMushroomBlockId26_3,
  resolveShelfMushroomLanding26_3,
} from '../src/world/WildernessBoundGameplay26_3';

registerWildernessBound26_3();

const idleInput: Parameters<Player['update']>[1] = {
  dx: 0, dy: 0, forward: false, back: false, left: false, right: false,
  jump: false, sprint: false, sneak: false, fly: false,
};

function shelfChunks() {
  return {
    getBlock: (x: number, y: number, z: number) => x === 0 && y === 64 && z === 0 ? SHELF_MUSHROOM_BLOCK.id : 0,
    isSolidBlock: () => false,
  } as any;
}

test('271: Shelf Mushroom runtime id is detected through the live BlockRegistry', () => {
  assert.equal(isShelfMushroomBlockId26_3(SHELF_MUSHROOM_BLOCK.id), true);
  assert.equal(isShelfMushroomBlockId26_3(0), false);
});

test('272: shelf landing resolver only supports the 26.3 Shelf Mushroom block', () => {
  const shelf = resolveShelfMushroomLanding26_3(SHELF_MUSHROOM_BLOCK.id, -4, false);
  assert.equal(shelf.supported, true);
  assert.equal(shelf.bounced, true);
  assert.equal(shelf.verticalVelocity, 2);
  assert.equal(resolveShelfMushroomLanding26_3(0, -4, false).supported, false);
});

test('273: player physics bounces from Shelf Mushroom instead of falling through it', () => {
  const player = new Player(0.5, 65.2, 0.5);
  player.velocity.y = -3;
  player.update(0.05, idleInput, shelfChunks());
  assert.ok(Math.abs(player.position.y - 65.001) < 1e-6);
  assert.ok(player.velocity.y > 0);
  assert.equal(player.onGround, false);
});

test('274: sneaking suppresses Shelf Mushroom bounce while preserving support', () => {
  const player = new Player(0.5, 65.2, 0.5);
  player.velocity.y = -3;
  player.update(0.05, { ...idleInput, sneak: true }, shelfChunks());
  assert.ok(Math.abs(player.position.y - 65.001) < 1e-6);
  assert.equal(player.velocity.y, 0);
  assert.equal(player.onGround, true);
  assert.equal(player.consumeShelfMushroomBounceSound26_3(), null);
});

test('275: player bounce sound is emitted once per Shelf Mushroom landing', () => {
  const player = new Player(0.5, 65.2, 0.5);
  player.velocity.y = -3;
  player.update(0.05, idleInput, shelfChunks());
  assert.equal(player.consumeShelfMushroomBounceSound26_3(), 'block.shelf_mushroom.bounce');
  assert.equal(player.consumeShelfMushroomBounceSound26_3(), null);
});

test('276: living Mob physics bounces from Shelf Mushroom and exposes the dedicated sound', () => {
  const mob = new Mob('cow', 0.5, 65.2, 0.5);
  mob.isSitting = true;
  mob.velocity.y = -3;
  mob.update(0.05, new THREE.Vector3(4, 65, 4), shelfChunks().getBlock, () => {}, () => false);
  assert.ok(Math.abs(mob.position.y - 65.001) < 1e-6);
  assert.ok(mob.velocity.y > 0);
  assert.equal(mob.onGround, false);
  assert.equal(mob.consumeShelfMushroomBounceSound26_3(), 'block.shelf_mushroom.bounce');
  assert.equal(mob.consumeShelfMushroomBounceSound26_3(), null);
  mob.dispose();
});

test('277: MobSystem propagates Shelf Mushroom bounce sounds from live mob updates', () => {
  const system = new MobSystem(new THREE.Scene());
  system.doMobSpawning = false;
  const mob = system.spawnMob('cow', 0.5, 65.2, 0.5)!;
  mob.isSitting = true;
  mob.velocity.y = -3;
  const events: string[] = [];
  system.update(
    0.05,
    new THREE.Vector3(4, 65, 4),
    false,
    shelfChunks().getBlock,
    () => {},
    () => false,
    'survival',
    undefined,
    undefined,
    0,
    undefined,
    0,
    undefined,
    undefined,
    undefined,
    (_mob, eventName) => events.push(eventName),
  );
  assert.deepEqual(events, ['block.shelf_mushroom.bounce']);
  system.clear();
});

test('278: VillageSystem resolves both Java 26.3 Wandering Trader additions to live item ids', () => {
  const offers = VillageSystem.getWanderingTraderOffers26_3();
  assert.equal(offers.length, 2);
  const sapling = offers.find(offer => offer.id === 'wandering_trader_poplar_sapling');
  const mushroom = offers.find(offer => offer.id === 'wandering_trader_shelf_mushroom');
  assert.equal(sapling?.output.id, ItemRegistry.getByName('poplar_sapling')?.id);
  assert.equal(mushroom?.output.id, ItemRegistry.getByName('shelf_mushroom')?.id);
  assert.ok(offers.every(offer => offer.profession === 'wandering_trader'));
});

test('279: Poplar Sapling Wandering Trader offer executes through the shared trade transaction', () => {
  const inventory = new Inventory();
  const emerald = ItemRegistry.getByName('emerald')!;
  const offer = VillageSystem.getWanderingTraderOffers26_3().find(entry => entry.id === 'wandering_trader_poplar_sapling')!;
  inventory.addItem(emerald.id, offer.input.count);
  assert.equal(VillageSystem.performTrade(inventory, offer), true);
  assert.equal(inventory.countItem(emerald.id), 0);
  assert.equal(inventory.countItem(offer.output.id), offer.output.count);
});

test('280: Shelf Mushroom Wandering Trader trade rejects missing payment without creating output', () => {
  const inventory = new Inventory();
  const offer = VillageSystem.getWanderingTraderOffers26_3().find(entry => entry.id === 'wandering_trader_shelf_mushroom')!;
  assert.equal(VillageSystem.performTrade(inventory, offer), false);
  assert.equal(inventory.countItem(offer.output.id), 0);
});

const gameSource = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
assert.match(gameSource, /consumeShelfMushroomBounceSound26_3/);
assert.match(gameSource, /playNamedEvent26_3\(eventName\)/);

import { readFileSync } from 'node:fs';
`);

console.log('Applied parity 271-280 shelf physics and trader runtime bridge.');
