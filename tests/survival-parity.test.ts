import assert from 'node:assert/strict';
import test from 'node:test';
import { SurvivalSystem } from '../src/systems/SurvivalSystem';

function makePlayer(overrides: Record<string, unknown> = {}) {
  const position = { x: 0, y: 64, z: 0 };
  return {
    position,
    eyePosition: { x: 0, y: 65.62, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    onGround: true,
    speedMultiplier: 1,
    health: 20,
    hunger: 20,
    saturation: 5,
    oxygen: 15,
    flying: false,
    ...overrides,
  } as any;
}

const noBlocks = () => 0;
const defaultRules = { getRule: () => true };

test('standing still does not consume saturation or hunger', () => {
  const system = new SurvivalSystem();
  const player = makePlayer();
  for (let i = 0; i < 200; i++) {
    system.update(0.05, player, 'survival', noBlocks, () => {}, 'normal', defaultRules);
  }
  assert.equal(player.saturation, 5);
  assert.equal(player.hunger, 20);
});

test('naturalRegeneration gamerule disables food-based healing', () => {
  const system = new SurvivalSystem();
  const player = makePlayer({ health: 10, saturation: 6 });
  const rules = { getRule: (name: string) => name === 'naturalRegeneration' ? false : true };
  for (let i = 0; i < 40; i++) {
    system.update(0.05, player, 'survival', noBlocks, () => {}, 'normal', rules);
  }
  assert.equal(player.health, 10);
});

test('full hunger plus saturation uses Java fast regeneration cadence', () => {
  const system = new SurvivalSystem();
  const player = makePlayer({ health: 10, saturation: 6 });
  for (let i = 0; i < 10; i++) {
    system.update(0.05, player, 'survival', noBlocks, () => {}, 'normal', defaultRules);
  }
  assert.equal(player.health, 11);
});

test('drowning starts one second after the 15-second air supply is exhausted', () => {
  const system = new SurvivalSystem();
  const player = makePlayer({ oxygen: 0 });
  const damage: Array<[number, string]> = [];
  system.update(1, player, 'survival', () => 8, (amount, type) => damage.push([amount, type]), 'normal', defaultRules);
  assert.deepEqual(damage, [[2, 'drown']]);
});

test('Respiration extends expected underwater air time instead of granting immunity', () => {
  const system = new SurvivalSystem();
  const player = makePlayer();
  system.update(1, player, 'survival', () => 8, () => {}, 'normal', defaultRules, () => false, (id) => id === 'respiration' ? 3 : 0);
  assert.equal(player.oxygen, 14.75);
});

test('air supply refills at four air ticks per game tick equivalent', () => {
  const system = new SurvivalSystem();
  const player = makePlayer({ oxygen: 0 });
  system.update(1, player, 'survival', noBlocks, () => {}, 'normal', defaultRules);
  assert.equal(player.oxygen, 4);
});
