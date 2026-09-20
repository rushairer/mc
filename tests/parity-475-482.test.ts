import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { consumeOneWithRemainder } from '../src/server/PlayerStateRules';
import { getBedOtherPosition } from '../src/world/BedRules';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();

test('475: server consumable rules replace an emptied Milk Bucket with its Bucket remainder', () => {
  const result = consumeOneWithRemainder({ id: 335, count: 1 }, 325);
  assert.deepEqual(result.stack, { id: 325, count: 1 });
  assert.equal(result.remainder, null);
});

test('476: stacked consumables preserve the remaining stack and emit a separate container remainder', () => {
  const result = consumeOneWithRemainder({ id: 454, count: 3 }, 374);
  assert.deepEqual(result.stack, { id: 454, count: 2 });
  assert.deepEqual(result.remainder, { id: 374, count: 1 });
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(server.includes('getDefaultUseRemainderItemId(itemId)'));
  assert.ok(server.includes('insertItemStackIntoSlots(session.inventory, outcome.remainder)'));
  assert.ok(server.includes('this.spawnDroppedStack('));
});

test('477: door placement requires a solid supporting block before creating either half', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private placeDoor[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('y <= 0'));
  assert.ok(method.includes('BlockRegistry.isSolid(this.chunks.getBlock(x, y - 1, z))'));
});

test('478: bed placement requires support below both foot and head', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private placeBed[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('BlockRegistry.isSolid(this.chunks.getBlock(x, y - 1, z))'));
  assert.ok(method.includes('BlockRegistry.isSolid(this.chunks.getBlock(headX, y - 1, headZ))'));
});

test('479: bed partner resolution works from both the foot and the head', () => {
  assert.deepEqual(
    getBedOtherPosition({ x: 10, y: 64, z: 10 }, { facing: 'east', bedPart: 'foot' }),
    { x: 11, y: 64, z: 10 },
  );
  assert.deepEqual(
    getBedOtherPosition({ x: 11, y: 64, z: 10 }, { facing: 'east', bedPart: 'head' }),
    { x: 10, y: 64, z: 10 },
  );
});

test('480: door destruction captures the partner before clearing and destroys the other half without a duplicate drop', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private destroyBlockAt[\s\S]*?\n  \}/)?.[0] ?? '';
  const capture = method.indexOf('const doorPartnerY');
  const clear = method.indexOf('this.chunks.setBlock(x, y, z, 0)');
  assert.ok(capture >= 0 && capture < clear);
  assert.ok(method.includes('this.destroyBlockAt(x, doorPartnerY, z, false)'));
});

test('481: modern beds including Straw Bed use name-based paired destruction rather than legacy id 26 only', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private destroyBlockAt[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes("def.name === 'bed' || def.name.endsWith('_bed')"));
  assert.ok(method.includes('getBedOtherPosition({ x, y, z }, meta)'));
  assert.ok(method.includes('partnerDef?.name === def?.name'));
});

test('482: breaking a door resolves the actual door item instead of the historical flower drop', () => {
  assert.equal(ItemRegistry.getItemIdForPlacedBlock(64), 324);
  const poplarDoor = BlockRegistry.getByName('poplar_door');
  const poplarDoorItem = ItemRegistry.getByName('poplar_door');
  assert.ok(poplarDoor);
  assert.ok(poplarDoorItem);
  assert.equal(ItemRegistry.getItemIdForPlacedBlock(poplarDoor.id), poplarDoorItem.id);
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private destroyBlockAt[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('ItemRegistry.getItemIdForPlacedBlock(blockId)'));
  assert.ok(!method.includes('spawnItem(37, 1, dropPos'));
});
