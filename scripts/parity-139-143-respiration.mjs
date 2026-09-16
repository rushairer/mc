import { readFileSync, writeFileSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content, 'utf8'); }
function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`missing patch target: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`ambiguous patch target: ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

{
  const path = 'src/systems/SurvivalSystem.ts';
  let s = read(path);
  s = replaceOnce(s,
`import { BlockRegistry } from '../world/BlockRegistry';`,
`import { BlockRegistry } from '../world/BlockRegistry';
import { XorShiftRandom } from '../engine/DeterministicRandom';`, 'random import');

  s = replaceOnce(s,
`const MAX_AIR_SECONDS = 15.0;
const AIR_REFILL_MULTIPLIER = 4.0;
const DROWNING_DAMAGE_INTERVAL = 1.0;`,
`const MAX_AIR_SECONDS = 15.0;
const AIR_REFILL_MULTIPLIER = 4.0;
const GAME_TICK_SECONDS = 0.05;
const AIR_SECONDS_PER_TICK = 0.05;
const DROWNING_DRAIN_TICKS = 20;`, 'air constants');

  s = replaceOnce(s,
`const TIMER_EPSILON = 1e-9;

export class SurvivalSystem {`,
`const TIMER_EPSILON = 1e-9;

export interface AirRandomSource {
  nextInt(maxExclusive: number): number;
}

/** Java 1.20.1: Respiration level N skips air loss when nextInt(N + 1) > 0. */
export function shouldConsumeAir(respirationLevel: number, random: AirRandomSource): boolean {
  const level = Math.max(0, Math.floor(respirationLevel));
  return level === 0 || random.nextInt(level + 1) === 0;
}

export class SurvivalSystem {`, 'respiration rule helper');

  s = replaceOnce(s,
`  private wasOnGround = true;
  private drownTimer = 0;
  private lavaDamageTimer = 0;`,
`  private wasOnGround = true;
  private airTickAccumulator = 0;
  private drowningDrainTicks = 0;
  private lavaDamageTimer = 0;`, 'air tick state');

  s = replaceOnce(s,
`  private lastPlayerX: number | null = null;
  private lastPlayerZ: number | null = null;

  update(`,
`  private lastPlayerX: number | null = null;
  private lastPlayerZ: number | null = null;
  private airRandom: AirRandomSource;

  constructor(airRandom: AirRandomSource = new XorShiftRandom(0x53555256)) {
    this.airRandom = airRandom;
  }

  setAirRandomSource(airRandom: AirRandomSource) {
    this.airRandom = airRandom;
    this.airTickAccumulator = 0;
    this.drowningDrainTicks = 0;
  }

  update(`, 'survival random source');

  s = replaceOnce(s,
`      player.oxygen = MAX_AIR_SECONDS;
      this.drownTimer = 0;
      return;`,
`      player.oxygen = MAX_AIR_SECONDS;
      this.airTickAccumulator = 0;
      this.drowningDrainTicks = 0;
      return;`, 'creative air reset');

  const oldDrowning = `    if (isUnderwater) {
      const respiration = Math.max(0, getEnchantLevel('respiration'));
      const canBreathe = hasEffect('water_breathing');
      if (!canBreathe) {
        // Respiration is probabilistic in vanilla. A deterministic equivalent uses
        // its expected drain rate: level N extends average air time by N + 1.
        const drainRate = 1 / (respiration + 1);
        player.oxygen = Math.max(0, player.oxygen - dt * drainRate);

        if (player.oxygen <= 0 && doDrowningDamage) {
          this.drownTimer += dt;
          if (this.drownTimer + TIMER_EPSILON >= DROWNING_DAMAGE_INTERVAL) {
            damage(2, 'drown');
            this.drownTimer = Math.max(0, this.drownTimer - DROWNING_DAMAGE_INTERVAL);
          }
        } else {
          this.drownTimer = 0;
        }
      } else {
        player.oxygen = MAX_AIR_SECONDS;
        this.drownTimer = 0;
      }
    } else {
      // Vanilla replenishes four air-supply ticks per game tick.
      player.oxygen = Math.min(MAX_AIR_SECONDS, player.oxygen + dt * AIR_REFILL_MULTIPLIER);
      this.drownTimer = 0;
    }`;
  const newDrowning = `    if (isUnderwater) {
      const respiration = Math.max(0, getEnchantLevel('respiration'));
      const canBreathe = hasEffect('water_breathing');
      if (!canBreathe) {
        // Air supply is an integer tick counter in Java. Keep the public project
        // representation in seconds, but advance the exact rule on 20 TPS
        // boundaries so Respiration remains probabilistic instead of fractional.
        this.airTickAccumulator += dt;
        while (this.airTickAccumulator + TIMER_EPSILON >= GAME_TICK_SECONDS) {
          this.airTickAccumulator = Math.max(0, this.airTickAccumulator - GAME_TICK_SECONDS);
          if (!shouldConsumeAir(respiration, this.airRandom)) continue;

          if (player.oxygen > 0) {
            player.oxygen = Math.max(0, Math.round((player.oxygen - AIR_SECONDS_PER_TICK) * 100) / 100);
            this.drowningDrainTicks = 0;
          } else {
            // Vanilla hurts when air reaches -20, then resets air to zero. We
            // preserve oxygen >= 0 externally and track those 20 successful
            // decrements separately; Respiration therefore extends this phase too.
            this.drowningDrainTicks += 1;
            if (this.drowningDrainTicks >= DROWNING_DRAIN_TICKS) {
              if (doDrowningDamage) damage(2, 'drown');
              this.drowningDrainTicks = 0;
            }
          }
        }
      } else {
        player.oxygen = MAX_AIR_SECONDS;
        this.airTickAccumulator = 0;
        this.drowningDrainTicks = 0;
      }
    } else {
      // Vanilla replenishes four air-supply ticks per game tick.
      player.oxygen = Math.min(MAX_AIR_SECONDS, player.oxygen + dt * AIR_REFILL_MULTIPLIER);
      this.airTickAccumulator = 0;
      this.drowningDrainTicks = 0;
    }`;
  s = replaceOnce(s, oldDrowning, newDrowning, 'exact respiration and drowning');
  write(path, s);
}

{
  const path = 'src/engine/Game.ts';
  let s = read(path);
  s = replaceOnce(s,
`    this.survival = new SurvivalSystem();`,
`    this.survival = new SurvivalSystem(new XorShiftRandom(hashIntegers(this.seed, 0x53555256)));`, 'world-seeded survival random');
  write(path, s);
}

{
  const path = 'tests/survival-parity.test.ts';
  let s = read(path);
  s = replaceOnce(s,
`import { SurvivalSystem } from '../src/systems/SurvivalSystem';`,
`import { SurvivalSystem, shouldConsumeAir } from '../src/systems/SurvivalSystem';`, 'test helper import');

  s = replaceOnce(s,
`const noBlocks = () => 0;
const defaultRules = { getRule: () => true };`,
`const noBlocks = () => 0;
const defaultRules = { getRule: () => true };

class SequenceAirRandom {
  private index = 0;
  constructor(private readonly values: number[]) {}
  nextInt(maxExclusive: number) {
    if (this.values.length === 0) return 0;
    const value = this.values[this.index++ % this.values.length];
    return ((value % maxExclusive) + maxExclusive) % maxExclusive;
  }
}`, 'deterministic air test source');

  s = replaceOnce(s,
`test('Respiration extends expected underwater air time instead of granting immunity', () => {
  const system = new SurvivalSystem();
  const player = makePlayer();
  system.update(1, player, 'survival', () => 8, () => {}, 'normal', defaultRules, () => false, (id) => id === 'respiration' ? 3 : 0);
  assert.equal(player.oxygen, 14.75);
});`,
`test('Respiration consumes air only when the Java nextInt(level + 1) roll is zero', () => {
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
});`, 'respiration parity tests');
  write(path, s);
}

console.log('exact Java 1.20.1 Respiration parity applied');
