import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inferBlockBehaviorId } from '../src/world/BehaviorIds';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { findCraftingResult } from '../src/items/CraftingRecipes';
import { createContainerSlots } from '../src/server/ContainerRules';
import {
  activateDispenserLike,
  dispenserFacingOffset,
  insertOneFromDropper,
  selectDispenserSlot,
} from '../src/items/DispenserRules';
import type { ItemStack } from '../src/types';

const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};

test('843: Dispenser and Dropper expose one stable interaction behavior family', () => {
  assert.equal(inferBlockBehaviorId('dispenser'), 'minecraft:dispenser_dropper');
  assert.equal(inferBlockBehaviorId('minecraft:dropper'), 'minecraft:dispenser_dropper');
});

test('844: Dispenser and Dropper containers are exactly nine slots', () => {
  assert.equal(createContainerSlots('dispenser').length, 9);
  assert.equal(createContainerSlots('dropper').length, 9);
});

test('845: vanilla Dispenser and Dropper recipes remain craftable', () => {
  const cobble = item('cobblestone').id;
  const bow = item('bow').id;
  const redstone = item('redstone').id;
  assert.equal(findCraftingResult([
    cobble, cobble, cobble,
    cobble, bow, cobble,
    cobble, redstone, cobble,
  ])?.id, item('dispenser').id);
  assert.equal(findCraftingResult([
    cobble, cobble, cobble,
    cobble, 0, cobble,
    cobble, redstone, cobble,
  ])?.id, item('dropper').id);
});

test('846: local block interaction opens both blocks through the shared container surface', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("registerBlock(['dispenser', 'dropper']"));
  assert.ok(source.includes("id: 'minecraft:dispenser_dropper'"));
  assert.ok(source.includes('this.openChestUI(position.x, position.y, position.z)'));
});

test('847: local placement creates facing nine-slot container metadata', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (name === 'dispenser' || name === 'dropper')");
  assert.ok(start >= 0);
  const block = source.slice(start, start + 650);
  assert.ok(block.includes('facing,'));
  assert.ok(block.includes('containerType: name'));
  assert.ok(block.includes('inventory: new Array(9).fill(null)'));
  assert.ok(block.includes('powered: false'));
});

test('848: the shared container UI renders nine-slot machines as a 3x3 grid', () => {
  const source = readFileSync(new URL('../src/ui/ChestUI.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes("chestSlots.length === 9 ? 3 : 9"));
  assert.ok(source.includes('repeat(${containerColumns}, ${SLOT_SIZE}px)'));
  assert.ok(source.includes("| 'dispenser' | 'dropper'"));
});

test('849: Dispenser and Dropper container titles are localized', () => {
  const source = readFileSync(new URL('../src/i18n.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes("dispenser: 'Dispenser'"));
  assert.ok(source.includes("dropper: 'Dropper'"));
  assert.ok(source.includes("dispenser: '发射器'"));
  assert.ok(source.includes("dropper: '投掷器'"));
  assert.ok(source.includes("dispenser: '發射器'"));
  assert.ok(source.includes("dropper: '投擲器'"));
});

test('850: Dispenser and Dropper receive dedicated recognizable inventory icons', () => {
  const source = readFileSync(new URL('../src/engine/TextureAtlas.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("b.name === 'dispenser' || b.name === 'dropper'"));
  assert.ok(source.includes("if (b.name === 'dispenser')"));
});

test('851: multiplayer container-open authority recognizes Dispenser and Dropper before generic storage fallback', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("name === 'dispenser' || name === 'dropper'"));
  assert.ok(source.includes("'dispenser' | 'dropper' | null"));
  assert.ok(source.includes('createContainerSlots(kind)'));
});

test('852: multiplayer placement creates nine-slot machine metadata in both placement paths', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const matches = source.match(/inventory: new Array\(9\)\.fill\(null\)/g) ?? [];
  assert.ok(matches.length >= 2);
  assert.ok(source.includes('containerType: block.name'));
  assert.ok(source.includes('containerType: placedBlock.name'));
});

test('853: breaking a server-owned Dispenser or Dropper releases its stored stacks and clears coordinate storage', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf("blockDef?.name === 'dispenser' || blockDef?.name === 'dropper'");
  assert.ok(start >= 0);
  const block = source.slice(start, start + 1000);
  assert.ok(block.includes('this.containerData.get(key)'));
  assert.ok(block.includes('this.spawnDroppedStack(stack'));
  assert.ok(block.includes('this.containerData.delete(key)'));
});

test('854: slot selection reports empty when all nine slots are empty', () => {
  assert.equal(selectDispenserSlot(new Array(9).fill(null), () => 0.5), -1);
});

test('855: slot selection is uniform over non-empty slots rather than physical indices', () => {
  const paper = { id: item('paper').id, count: 1 };
  const slots: (ItemStack | null)[] = new Array(9).fill(null);
  slots[1] = paper;
  slots[4] = paper;
  slots[8] = paper;
  assert.equal(selectDispenserSlot(slots, () => 0), 1);
  assert.equal(selectDispenserSlot(slots, () => 0.34), 4);
  assert.equal(selectDispenserSlot(slots, () => 0.99), 8);
});

test('856: one activation consumes exactly one item from the chosen source stack', () => {
  const paper = { id: item('paper').id, count: 5 };
  const result = activateDispenserLike('dispenser', [paper], { random: () => 0 });
  assert.equal(result.action, 'eject');
  assert.equal(result.stack?.count, 1);
  assert.equal(result.sourceSlots[0]?.count, 4);
});

test('857: emitted items preserve modeled ItemStack components', () => {
  const book: ItemStack = {
    id: item('written_book').id,
    count: 2,
    customName: 'Machine Manual',
    book: { title: 'Guide', author: 'Builder', pages: ['A', 'B'], signed: true },
  };
  const result = activateDispenserLike('dispenser', [book], { random: () => 0 });
  assert.equal(result.stack?.customName, 'Machine Manual');
  assert.deepEqual(result.stack?.book?.pages, ['A', 'B']);
  assert.equal(result.sourceSlots[0]?.count, 1);
});

test('858: Dropper inserts one item into the first available target slot', () => {
  const paper = { id: item('paper').id, count: 3 };
  const result = activateDispenserLike('dropper', [paper], {
    targetSlots: new Array(9).fill(null),
    targetContainerType: 'dropper',
    random: () => 0,
  });
  assert.equal(result.action, 'insert');
  assert.equal(result.targetSlots?.[0]?.count, 1);
  assert.equal(result.sourceSlots[0]?.count, 2);
});

test('859: Dropper merges components only with a compatible target stack and respects Shulker nesting', () => {
  const paper: ItemStack = { id: item('paper').id, count: 1, customName: 'A' };
  const target: (ItemStack | null)[] = [{ id: item('paper').id, count: 2, customName: 'A' }];
  const merged = insertOneFromDropper(target, paper, 'chest');
  assert.equal(merged.inserted, true);
  assert.equal(merged.slots[0]?.count, 3);

  const shulker = { id: item('shulker_box').id, count: 1 };
  const nested = insertOneFromDropper(new Array(27).fill(null), shulker, 'shulker_box');
  assert.equal(nested.inserted, false);
});

test('860: a full target makes Dropper fall back to ejecting one item into the world', () => {
  const paper = { id: item('paper').id, count: 2 };
  const full = new Array(9).fill(null).map(() => ({ id: item('cobblestone').id, count: 64 }));
  const result = activateDispenserLike('dropper', [paper], {
    targetSlots: full,
    targetContainerType: 'dropper',
    random: () => 0,
  });
  assert.equal(result.action, 'eject');
  assert.equal(result.stack?.id, paper.id);
  assert.equal(result.sourceSlots[0]?.count, 1);
});

test('861: Dispenser uses the eject path even when a container is directly in front', () => {
  const paper = { id: item('paper').id, count: 1 };
  const result = activateDispenserLike('dispenser', [paper], {
    targetSlots: new Array(9).fill(null),
    targetContainerType: 'dropper',
    random: () => 0,
  });
  assert.equal(result.action, 'eject');
  assert.equal(result.targetSlots?.every((slot) => slot === null), true);
  assert.equal(result.sourceSlots[0], null);
  assert.deepEqual(dispenserFacingOffset('east'), { x: 1, y: 0, z: 0 });
});

test('862: local redstone activation is rising-edge gated and points output along stored facing', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (name === 'dispenser' || name === 'dropper')");
  assert.ok(start >= 0);
  const powerBlock = source.slice(start, start + 850);
  assert.ok(powerBlock.includes('powered && !wasPowered'));
  assert.ok(powerBlock.includes('this.activateDispenserDropper(x, y, z, name)'));
  assert.ok(source.includes('const offset = dispenserFacingOffset(meta.facing)'));
  assert.ok(source.includes('this.droppedItems.spawnStack(result.stack, spawnPos, velocity, 0.2)'));
});
