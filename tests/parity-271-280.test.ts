import assert from 'node:assert/strict';
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
    undefined,
    (_mob, eventName) => events.push(eventName),
  );
  assert.deepEqual(events, ['block.shelf_mushroom.bounce']);
  system.dispose();
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
