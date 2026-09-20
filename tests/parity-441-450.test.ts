import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CushionSeatSystem26_3,
  cushionColorFromItemName26_3,
  snapCushionPlacement,
} from '../src/world/WildernessBoundGameplay26_3';

test('441: Cushion item names resolve their Java 26.3 dye color', () => {
  assert.equal(cushionColorFromItemName26_3('minecraft:red_cushion'), 'red');
  assert.equal(cushionColorFromItemName26_3('light_blue_cushion'), 'light_blue');
});

test('442: non-Cushion and invalid dye names do not resolve as Cushion colors', () => {
  assert.equal(cushionColorFromItemName26_3('red_wool'), null);
  assert.equal(cushionColorFromItemName26_3('ultraviolet_cushion'), null);
});

test('443: Cushion placement snaps to the center of a valid supporting top face', () => {
  assert.deepEqual(snapCushionPlacement({
    hitX: 10.1, hitZ: 20.9, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'blue',
  }), { x: 10.5, y: 65, z: 20.5 });
});

test('444: Cushion placement refuses non-flat or unsupported surfaces', () => {
  assert.equal(snapCushionPlacement({
    hitX: 1, hitZ: 1, supportTopY: 2, flatSurface: false, supportingBlock: true, color: 'red',
  }), null);
  assert.equal(snapCushionPlacement({
    hitX: 1, hitZ: 1, supportTopY: 2, flatSurface: true, supportingBlock: false, color: 'red',
  }), null);
});

test('445: live Cushion seats can be found by their supporting block', () => {
  const seats = new CushionSeatSystem26_3();
  const seat = seats.place({
    hitX: 3.2, hitZ: 4.8, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'green',
  }, '3,64,4');
  assert.ok(seat);
  assert.equal(seats.getSeatForSupport('3,64,4')?.color, 'green');
});

test('446: one supporting block cannot create a duplicate seat at the same snapped point', () => {
  const seats = new CushionSeatSystem26_3();
  const request = { hitX: 3.2, hitZ: 4.8, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'green' as const };
  assert.ok(seats.place(request, '3,64,4'));
  assert.equal(seats.place(request, '3,64,4'), null);
});

test('447: sitting reserves a Cushion until the player stands up', () => {
  const seats = new CushionSeatSystem26_3();
  const seat = seats.place({
    hitX: 0.2, hitZ: 0.2, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'white',
  }, '0,64,0')!;
  assert.equal(seats.sit('player-a', seat).seated, true);
  assert.equal(seats.sit('player-b', seat).reason, 'occupied');
  assert.equal(seats.stand('player-a'), true);
  assert.equal(seats.sit('player-b', seat).seated, true);
});

test('448: removing a Cushion clears its occupant relationship', () => {
  const seats = new CushionSeatSystem26_3();
  const seat = seats.place({
    hitX: 0.2, hitZ: 0.2, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'white',
  }, '0,64,0')!;
  seats.sit('player-a', seat);
  assert.ok(seats.remove(seat));
  assert.equal(seats.isPlayerSitting('player-a'), false);
});

test('449: Game registers the minecraft:cushion runtime item behavior and consumes survival placement', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("id: 'minecraft:cushion'"));
  assert.ok(source.includes('this.tryPlaceCushion26_3(item.name, stack, target)'));
  assert.ok(source.includes("this.inventory.removeFromSlot(this.player.selectedSlot, 1)"));
  assert.ok(source.includes("this.gameMode !== 'creative'"));
});

test('450: Game wires Cushion seating, movement lock, and Shift dismount into the live player loop', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('this.trySitOnCushion26_3(targetInteraction)'));
  assert.ok(source.includes("this.cushionSeats26_3.stand('local-player')"));
  assert.ok(source.includes('sittingOnCushion26_3'));
  assert.ok(source.includes("mesh.name = 'wilderness-bound-cushion'"));
});
