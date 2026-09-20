import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createServerPlacementCells,
  getDoorSidePosition,
  horizontalFacingFromYaw,
  isPlacementReplaceableBlockName,
  resolveDoorHinge,
  signRotationFromYaw,
} from '../src/server/ServerPlacementRules';
import type { BlockPlacementPlan } from '../src/world/BlockPlacement';

const plan = (kind: BlockPlacementPlan['kind']): BlockPlacementPlan => ({
  kind,
  position: { x: 10, y: 64, z: 10 },
  blockId: 64,
  facing: 'up',
  opensSignEditor: false,
  schedulesFluid: false,
  checksWitherSpawn: false,
});

test('483: multiplayer placement packets include the original clicked target for server replanning', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('targetX: target.position.x'));
  assert.ok(source.includes('targetY: target.position.y'));
  assert.ok(source.includes('targetZ: target.position.z'));
  assert.ok(source.includes('targetFace: target.face'));
});

test('484: server placement reruns the shared planBlockPlacement contract instead of trusting final coordinates', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_BLOCK_PLACE');
  const end = source.indexOf('case PacketType.C2S_CHAT', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('planBlockPlacement({'));
  assert.ok(handler.includes('x !== plan.position.x'));
  assert.ok(handler.includes('blockId !== plan.blockId'));
});

test('485: server placement reach uses the actual session game mode', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('isBlockActionInReach(session, targetX, targetY, targetZ, session.gameMode)'));
});

test('486: yaw conversion matches the player forward convention', () => {
  assert.equal(horizontalFacingFromYaw(0), 'north');
  assert.equal(horizontalFacingFromYaw(Math.PI), 'south');
  assert.equal(horizontalFacingFromYaw(Math.PI / 2), 'west');
  assert.equal(horizontalFacingFromYaw(-Math.PI / 2), 'east');
});

test('487: door placement expands one authoritative plan into lower and upper halves', () => {
  const cells = createServerPlacementCells(plan('door'), 0, 'right');
  assert.equal(cells.length, 2);
  assert.deepEqual(cells[0].metadata, { facing: 'north', doorHalf: 'lower', hinge: 'right', open: false, powered: false });
  assert.deepEqual(cells[1].position, { x: 10, y: 65, z: 10 });
  assert.equal(cells[1].metadata?.doorHalf, 'upper');
});

test('488: door hinge rules mirror neighboring matching doors before player-side fallback', () => {
  assert.deepEqual(getDoorSidePosition(10, 10, 'north', 'left'), { x: 9, z: 10 });
  assert.equal(resolveDoorHinge(10, 10, 'north', 10.1, 10.5, true, false), 'right');
  assert.equal(resolveDoorHinge(10, 10, 'north', 10.1, 10.5, false, true), 'left');
  assert.equal(resolveDoorHinge(10, 10, 'north', 10.1, 10.5, false, false), 'left');
});

test('489: bed placement expands into foot and head using server-derived player facing', () => {
  const cells = createServerPlacementCells({ ...plan('bed'), blockId: 26 }, -Math.PI / 2);
  assert.equal(cells.length, 2);
  assert.deepEqual(cells[0].metadata, { facing: 'east', bedPart: 'foot' });
  assert.deepEqual(cells[1].position, { x: 11, y: 64, z: 10 });
  assert.deepEqual(cells[1].metadata, { facing: 'east', bedPart: 'head' });
});

test('490: slab placement preserves the planner slab-half decision for authoritative metadata', () => {
  const cells = createServerPlacementCells({ ...plan('slab'), blockId: 44, slabHalf: 'double' }, 0);
  assert.deepEqual(cells, [{
    position: { x: 10, y: 64, z: 10 },
    blockId: 44,
    metadata: { slabHalf: 'double' },
  }]);
});

test('491: server paired placement checks support and occupancy before mutating the world', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("if (plan.kind === 'door')"));
  assert.ok(source.includes('this.isSolidBlock(plan.position.x, plan.position.y - 1, plan.position.z, session.dimension)'));
  assert.ok(source.includes("} else if (plan.kind === 'bed')"));
  assert.ok(source.includes('cells.some((cell) => !this.isSolidBlock(cell.position.x, cell.position.y - 1, cell.position.z, session.dimension))'));
});

test('492: server signs get Java 26.3 two-sided default metadata and deterministic rotation', () => {
  assert.equal(signRotationFromYaw(0), 8);
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('createDefaultSignMetadata({ facing: plan.facing })'));
  assert.ok(source.includes('createDefaultSignMetadata({ rotation: signRotationFromYaw(session.yaw) })'));
});

test('493: replaceable placement cells cover plants without allowing arbitrary solid overwrite', () => {
  assert.equal(isPlacementReplaceableBlockName('air'), true);
  assert.equal(isPlacementReplaceableBlockName('tall_grass'), true);
  assert.equal(isPlacementReplaceableBlockName('oak_sapling'), true);
  assert.equal(isPlacementReplaceableBlockName('stone'), false);
});

test('494: multiplayer client no longer spends placed items optimistically and creative server placement never consumes', () => {
  const client = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(client.includes('if (!multiplayerPlacement && shouldConsumePlacedItem(this.gameMode))'));
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = server.indexOf('case PacketType.C2S_BLOCK_PLACE');
  const end = server.indexOf('case PacketType.C2S_CHAT', start);
  const handler = server.slice(start, end);
  assert.ok(handler.includes("if (session.gameMode !== 'creative')"));
});
