import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inferItemBehaviorId } from '../src/world/BehaviorIds';
import { resolveHoeFarmlandTargetName } from '../src/world/ItemOnBlockRules';
import {
  END_PORTAL_BLOCK_ID,
  END_PORTAL_FRAME_BLOCK_ID,
  fillEndPortalFrameBlock,
  findCompleteEndPortalCenter,
  getEndPortalInteriorCells,
  isCompleteEndPortalAt,
} from '../src/world/EndPortalRules';
import { serverItemOnBlockKind } from '../src/server/ServerItemUseRules';

test('543: block interaction packet validates reach with the player actual game mode', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_INTERACT_BLOCK');
  const end = source.indexOf('case PacketType.C2S_VEHICLE_INTERACT', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('isBlockActionInReach(session, x, y, z, session.gameMode)'));
  assert.equal(handler.includes("isBlockActionInReach(session, x, y, z, 'survival')"), false);
});

test('544: every material Hoe classifies as an authoritative item-on-block tool', () => {
  for (const name of ['wooden_hoe', 'stone_hoe', 'iron_hoe', 'golden_hoe', 'diamond_hoe', 'netherite_hoe']) {
    assert.equal(serverItemOnBlockKind(name), 'hoe');
    assert.equal(inferItemBehaviorId(name), 'minecraft:hoe');
  }
  assert.equal(serverItemOnBlockKind('diamond_pickaxe'), null);
});

test('545: Hoe tilling targets only grass/dirt family accepted by the current farmland behavior', () => {
  assert.equal(resolveHoeFarmlandTargetName('grass'), 'farmland');
  assert.equal(resolveHoeFarmlandTargetName('grass_block'), 'farmland');
  assert.equal(resolveHoeFarmlandTargetName('dirt'), 'farmland');
  assert.equal(resolveHoeFarmlandTargetName('stone'), null);
});

test('546: multiplayer Hoe use sends C2S_ITEM_USE before any local farmland mutation', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryTillFarmland[\s\S]*?\n  \}/)?.[0] ?? '';
  const send = method.indexOf('this.sendServerBlockItemUse(held, target)');
  const mutate = method.indexOf('this.chunks.setBlock(');
  assert.ok(send >= 0 && mutate > send);
  assert.ok(method.includes("target.face === 'down'"));
  assert.ok(method.includes('this.chunks.getBlock(x, y + 1, z) !== 0'));
});

test('547: server Hoe computes initial hydration, packs farmland moisture, broadcasts it, and spends durability only on success', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf("itemOnBlockKind === 'hoe'");
  const end = source.indexOf("itemOnBlockKind === 'fire_charge'", start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('this.isServerWaterNearby'));
  assert.ok(handler.includes('const packedFarmland = (moisture << 10) | farmland.id'));
  assert.ok(handler.includes('this.broadcastServerBlockUpdate'));
  assert.ok(handler.includes('this.damageServerHeldTool(session, held)'));
});

test('548: Fire Charge has a first-class behavior and authoritative server classification', () => {
  assert.equal(inferItemBehaviorId('fire_charge'), 'minecraft:fire_charge');
  assert.equal(serverItemOnBlockKind('fire_charge'), 'fire_charge');
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("id: 'minecraft:fire_charge'"));
  assert.ok(source.includes('this.tryUseFireCharge(target)'));
});

test('549: multiplayer Fire Charge use routes to the server before local TNT/fire/portal mutation', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseFireCharge[\s\S]*?\n  \}/)?.[0] ?? '';
  const send = method.indexOf('this.sendServerBlockItemUse(held, target)');
  const tnt = method.indexOf('this.igniteTNT(');
  assert.ok(send >= 0 && tnt > send);
  assert.ok(method.includes("this.inventory.removeFromSlot(this.player.selectedSlot, 1)"));
});

test('550: server Fire Charge primes TNT with the canonical fuse and consumes an item instead of tool durability', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf("itemOnBlockKind === 'fire_charge'");
  const end = source.indexOf("itemOnBlockKind === 'ender_eye'", start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes("targetBlock.name === 'tnt'"));
  assert.ok(handler.includes('fuseSeconds: SERVER_TNT_FUSE_SECONDS'));
  assert.ok(handler.includes('this.consumeServerHeldItem(session, held)'));
  assert.equal(handler.includes('this.damageServerHeldTool(session, held)'), false);
});

test('551: server Fire Charge activates Nether portals before falling back to adjacent fire placement', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf("itemOnBlockKind === 'fire_charge'");
  const end = source.indexOf("itemOnBlockKind === 'ender_eye'", start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('findAndActivatePortalFrame'));
  assert.ok(handler.includes("BlockRegistry.getByName('fire')"));
  assert.ok(handler.indexOf('findAndActivatePortalFrame') < handler.indexOf("BlockRegistry.getByName('fire')"));
});

test('552: Ender Eye frame rules fill once, require all twelve filled frames, and expose exactly nine portal interior cells', () => {
  assert.equal(fillEndPortalFrameBlock(END_PORTAL_FRAME_BLOCK_ID), (4 << 10) | END_PORTAL_FRAME_BLOCK_ID);
  assert.equal(fillEndPortalFrameBlock((4 << 10) | END_PORTAL_FRAME_BLOCK_ID), null);

  const center = { x: 10, y: 40, z: 10 };
  const world = new Map<string, number>();
  const key = (x:number,y:number,z:number) => `${x},${y},${z}`;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const onFrame = (Math.abs(dx) === 2 && Math.abs(dz) <= 1) || (Math.abs(dz) === 2 && Math.abs(dx) <= 1);
      if (onFrame) world.set(key(center.x + dx, center.y, center.z + dz), (4 << 10) | END_PORTAL_FRAME_BLOCK_ID);
    }
  }
  const getBlock = (x:number,y:number,z:number) => world.get(key(x,y,z)) ?? 0;
  assert.equal(isCompleteEndPortalAt(getBlock, center.x, center.y, center.z), true);
  assert.deepEqual(findCompleteEndPortalCenter(getBlock, center.x + 2, center.y, center.z), center);
  assert.equal(getEndPortalInteriorCells(center.x, center.y, center.z).length, 9);
  assert.equal(END_PORTAL_BLOCK_ID, 119);
});
