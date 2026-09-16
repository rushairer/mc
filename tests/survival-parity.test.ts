import assert from 'node:assert/strict';
import test from 'node:test';
import { SurvivalSystem, shouldConsumeAir } from '../src/systems/SurvivalSystem';
import { BlockRegistry } from '../src/world/BlockRegistry';

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

class SequenceAirRandom {
  private index = 0;
  constructor(private readonly values: number[]) {}
  nextInt(maxExclusive: number) {
    if (this.values.length === 0) return 0;
    const value = this.values[this.index++ % this.values.length];
    return ((value % maxExclusive) + maxExclusive) % maxExclusive;
  }
}

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

test('Peaceful restores one food point every 10 game ticks in Java 1.20.1', () => {
  const system = new SurvivalSystem();
  const player = makePlayer({ hunger: 18, saturation: 0 });
  system.update(0.49, player, 'survival', noBlocks, () => {}, 'peaceful', defaultRules);
  assert.equal(player.hunger, 18);
  system.update(0.01, player, 'survival', noBlocks, () => {}, 'peaceful', defaultRules);
  assert.equal(player.hunger, 19);
});

test('Peaceful does not restore saturation in Java 1.20.1', () => {
  const system = new SurvivalSystem();
  const player = makePlayer({ saturation: 0 });
  for (let i = 0; i < 80; i++) {
    system.update(0.05, player, 'survival', noBlocks, () => {}, 'peaceful', defaultRules);
  }
  assert.equal(player.saturation, 0);
});

test('Peaceful restores one health per second and obeys naturalRegeneration', () => {
  const system = new SurvivalSystem();
  const player = makePlayer({ health: 10, hunger: 18, saturation: 0 });
  system.update(0.5, player, 'survival', noBlocks, () => {}, 'peaceful', defaultRules);
  assert.equal(player.health, 10);
  system.update(0.5, player, 'survival', noBlocks, () => {}, 'peaceful', defaultRules);
  assert.equal(player.health, 11);

  const disabled = new SurvivalSystem();
  const disabledPlayer = makePlayer({ health: 10, hunger: 18, saturation: 0 });
  const rules = { getRule: (name: string) => name === 'naturalRegeneration' ? false : true };
  disabled.update(2, disabledPlayer, 'survival', noBlocks, () => {}, 'peaceful', rules);
  assert.equal(disabledPlayer.health, 10);
  assert.equal(disabledPlayer.hunger, 18);
});

test('starvation cadence and difficulty health floors match Java 1.20.1', () => {
  for (const [difficulty, startHealth, expected] of [
    ['easy', 11, 10],
    ['normal', 2, 1],
    ['hard', 1, 0],
  ] as const) {
    const system = new SurvivalSystem();
    const player = makePlayer({ health: startHealth, hunger: 0, saturation: 0 });
    const damage = (amount: number) => { player.health = Math.max(0, player.health - amount); };
    system.update(3.95, player, 'survival', noBlocks, damage as any, difficulty, defaultRules);
    assert.equal(player.health, startHealth, `${difficulty} waits the full four seconds`);
    system.update(0.05, player, 'survival', noBlocks, damage as any, difficulty, defaultRules);
    assert.equal(player.health, expected, `${difficulty} reaches its starvation floor`);
    system.update(8, player, 'survival', noBlocks, damage as any, difficulty, defaultRules);
    assert.equal(player.health, expected, `${difficulty} does not pass its starvation floor`);
  }
});

test('fractional fall distance rounds damage up like Java', () => {
  const system = new SurvivalSystem();
  const player = makePlayer({ onGround: false, velocity: { x: 0, y: -1, z: 0 } });
  const damage: Array<[number, string]> = [];
  system.update(0.05, player, 'survival', noBlocks, (amount, type) => damage.push([amount, type]), 'normal', defaultRules);
  player.position.y = 60.1;
  player.eyePosition.y = 61.72;
  player.onGround = true;
  player.velocity.y = 0;
  system.update(0.05, player, 'survival', noBlocks, (amount, type) => damage.push([amount, type]), 'normal', defaultRules);
  assert.deepEqual(damage, [[1, 'fall']]);
});

test('standing inside fire deals one heart every half second', () => {
  const fireId = BlockRegistry.getByName('fire')?.id;
  assert.ok(fireId !== undefined, 'fire block is registered');
  const system = new SurvivalSystem();
  const player = makePlayer();
  const damage: Array<[number, string]> = [];
  const getBlock = (_x: number, y: number, _z: number) => y === 64 ? fireId! : 0;
  system.update(0.49, player, 'survival', getBlock, (amount, type) => damage.push([amount, type]), 'normal', defaultRules);
  assert.deepEqual(damage, []);
  system.update(0.01, player, 'survival', getBlock, (amount, type) => damage.push([amount, type]), 'normal', defaultRules);
  assert.deepEqual(damage, [[2, 'fire']]);
});

test('drowning starts one second after the 15-second air supply is exhausted', () => {
  const system = new SurvivalSystem();
  const player = makePlayer({ oxygen: 0 });
  const damage: Array<[number, string]> = [];
  system.update(1, player, 'survival', () => 8, (amount, type) => damage.push([amount, type]), 'normal', defaultRules);
  assert.deepEqual(damage, [[2, 'drown']]);
});

test('drowningDamage gamerule prevents drowning damage but still drains air', () => {
  const system = new SurvivalSystem();
  const player = makePlayer({ oxygen: 1 });
  const damage: Array<[number, string]> = [];
  const rules = { getRule: (name: string) => name === 'drowningDamage' ? false : true };
  system.update(2, player, 'survival', () => 8, (amount, type) => damage.push([amount, type]), 'normal', rules);
  assert.equal(player.oxygen, 0);
  assert.deepEqual(damage, []);
});

test('Respiration consumes air only when the Java nextInt(level + 1) roll is zero', () => {
  const random = new SequenceAirRandom([1, 2, 3, 0]);
  const system = new SurvivalSystem(random);
  const player = makePlayer();
  system.update(1, player, 'survival', () => 8, () => {}, 'normal', defaultRules, () => false, (id) => id === 'respiration' ? 3 : 0);
  assert.equal(player.oxygen, 14.75);
});

test('Respiration skip rolls leave air unchanged while a zero roll consumes one air tick', () => {
  const random = new SequenceAirRandom([3, 2, 1, 0]);
  assert.equal(shouldConsumeAir(3, random), false);
  assert.equal(shouldConsumeAir(3, random), false);
  assert.equal(shouldConsumeAir(3, random), false);
  assert.equal(shouldConsumeAir(3, random), true);
});

test('Respiration also stretches the negative-air drowning countdown', () => {
  const system = new SurvivalSystem(new SequenceAirRandom([1, 2, 3, 0]));
  const player = makePlayer({ oxygen: 0 });
  const damage: Array<[number, string]> = [];
  system.update(3.95, player, 'survival', () => 8, (amount, type) => damage.push([amount, type]), 'normal', defaultRules, () => false, (id) => id === 'respiration' ? 3 : 0);
  assert.deepEqual(damage, []);
  system.update(0.05, player, 'survival', () => 8, (amount, type) => damage.push([amount, type]), 'normal', defaultRules, () => false, (id) => id === 'respiration' ? 3 : 0);
  assert.deepEqual(damage, [[2, 'drown']]);
});

test('air supply refills at four air ticks per game tick equivalent', () => {
  const system = new SurvivalSystem();
  const player = makePlayer({ oxygen: 0 });
  system.update(1, player, 'survival', noBlocks, () => {}, 'normal', defaultRules);
  assert.equal(player.oxygen, 4);
});
