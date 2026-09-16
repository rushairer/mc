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
`const LAVA_DAMAGE_INTERVAL = 0.5;
const FIRE_CONTACT_DAMAGE_INTERVAL = 0.5;
const TIMER_EPSILON = 1e-9;`,
`const LAVA_DAMAGE_INTERVAL = 0.5;
const FIRE_CONTACT_DAMAGE_INTERVAL = 0.5;
const BURN_DAMAGE_INTERVAL = 1.0;
const FIRE_IGNITION_SECONDS = 8;
const LAVA_IGNITION_SECONDS = 15;
const FIRE_PROTECTION_BURN_REDUCTION_PER_LEVEL = 0.15;
const TIMER_EPSILON = 1e-9;`, 'burn constants');

  s = replaceOnce(s,
`export function shouldConsumeAir(respirationLevel: number, random: AirRandomSource): boolean {
  const level = Math.max(0, Math.floor(respirationLevel));
  return level === 0 || random.nextInt(level + 1) === 0;
}

export class SurvivalSystem {`,
`export function shouldConsumeAir(respirationLevel: number, random: AirRandomSource): boolean {
  const level = Math.max(0, Math.floor(respirationLevel));
  return level === 0 || random.nextInt(level + 1) === 0;
}

export function getIgnitionSeconds(baseSeconds: number, fireProtectionLevel: number): number {
  const level = Math.max(0, Math.floor(fireProtectionLevel));
  const multiplier = Math.max(0, 1 - level * FIRE_PROTECTION_BURN_REDUCTION_PER_LEVEL);
  // Entity fire is stored in game ticks; floor to that 20 TPS precision.
  return Math.floor(baseSeconds * multiplier * 20 + TIMER_EPSILON) / 20;
}

export class SurvivalSystem {`, 'fire protection duration helper');

  s = replaceOnce(s,
`  private lavaDamageTimer = 0;
  private fireDamageTimer = 0;
  private lastPlayerX: number | null = null;`,
`  private lavaDamageTimer = 0;
  private fireDamageTimer = 0;
  private burnDamageTimer = 0;
  private remainingFireSeconds = 0;
  private lastPlayerX: number | null = null;`, 'burn state');

  s = replaceOnce(s,
`      this.airTickAccumulator = 0;
      this.drowningDrainTicks = 0;
      return;`,
`      this.airTickAccumulator = 0;
      this.drowningDrainTicks = 0;
      this.remainingFireSeconds = 0;
      this.burnDamageTimer = 0;
      return;`, 'creative burn reset');

  const oldFire = `    const isFootLava = (footBlock & 0x3FF) === 10 || (footBlock & 0x3FF) === 11;
    const isHeadLava = (headBlock & 0x3FF) === 10 || (headBlock & 0x3FF) === 11;
    const footName = BlockRegistry.get(footBlock)?.name;
    const headName = BlockRegistry.get(headBlock)?.name;
    const isInFire = footName === 'fire' || footName === 'soul_fire' || headName === 'fire' || headName === 'soul_fire';
    const doFireDamage = gamerules ? gamerules.getRule('fireDamage') : true;
    const fireImmune = hasEffect('fire_resistance');

    if ((isFootLava || isHeadLava) && doFireDamage && !fireImmune) {
      this.lavaDamageTimer += dt;
      while (this.lavaDamageTimer + TIMER_EPSILON >= LAVA_DAMAGE_INTERVAL) {
        damage(4, 'lava');
        this.lavaDamageTimer = Math.max(0, this.lavaDamageTimer - LAVA_DAMAGE_INTERVAL);
      }
    } else {
      this.lavaDamageTimer = 0;
    }

    if (isInFire && doFireDamage && !fireImmune) {
      this.fireDamageTimer += dt;
      while (this.fireDamageTimer + TIMER_EPSILON >= FIRE_CONTACT_DAMAGE_INTERVAL) {
        damage(2, 'fire');
        this.fireDamageTimer = Math.max(0, this.fireDamageTimer - FIRE_CONTACT_DAMAGE_INTERVAL);
      }
    } else {
      this.fireDamageTimer = 0;
    }`;

  const newFire = `    const isFootLava = (footBlock & 0x3FF) === 10 || (footBlock & 0x3FF) === 11;
    const isHeadLava = (headBlock & 0x3FF) === 10 || (headBlock & 0x3FF) === 11;
    const isFootWater = (footBlock & 0x3FF) === 8 || (footBlock & 0x3FF) === 9;
    const footName = BlockRegistry.get(footBlock)?.name;
    const headName = BlockRegistry.get(headBlock)?.name;
    const isSoulFire = footName === 'soul_fire' || headName === 'soul_fire';
    const isInFire = isSoulFire || footName === 'fire' || headName === 'fire';
    const isInLava = isFootLava || isHeadLava;
    const isExtinguishedByWater = isFootWater || isUnderwater;
    const doFireDamage = gamerules ? gamerules.getRule('fireDamage') : true;
    const fireImmune = hasEffect('fire_resistance');
    const fireProtection = Math.max(0, getEnchantLevel('fire_protection'));

    // Ignition is stateful in Java: leaving a fire/lava source does not
    // immediately stop burning. Fire Protection reduces the duration using the
    // highest equipped level in 1.20.1, while Fire Resistance prevents damage
    // rather than erasing the fire timer.
    if (isExtinguishedByWater) {
      this.remainingFireSeconds = 0;
      this.burnDamageTimer = 0;
    } else if (isInLava) {
      this.remainingFireSeconds = Math.max(
        this.remainingFireSeconds,
        getIgnitionSeconds(LAVA_IGNITION_SECONDS, fireProtection),
      );
      this.burnDamageTimer = 0;
    } else if (isInFire) {
      this.remainingFireSeconds = Math.max(
        this.remainingFireSeconds,
        getIgnitionSeconds(FIRE_IGNITION_SECONDS, fireProtection),
      );
      this.burnDamageTimer = 0;
    } else if (this.remainingFireSeconds > 0) {
      const burningFor = Math.min(dt, this.remainingFireSeconds);
      this.remainingFireSeconds = Math.max(0, this.remainingFireSeconds - dt);
      if (doFireDamage && !fireImmune) {
        this.burnDamageTimer += burningFor;
        while (this.burnDamageTimer + TIMER_EPSILON >= BURN_DAMAGE_INTERVAL) {
          damage(2, 'fire');
          this.burnDamageTimer = Math.max(0, this.burnDamageTimer - BURN_DAMAGE_INTERVAL);
        }
      } else {
        this.burnDamageTimer = 0;
      }
    } else {
      this.burnDamageTimer = 0;
    }

    if (isInLava && doFireDamage && !fireImmune) {
      this.lavaDamageTimer += dt;
      while (this.lavaDamageTimer + TIMER_EPSILON >= LAVA_DAMAGE_INTERVAL) {
        damage(4, 'lava');
        this.lavaDamageTimer = Math.max(0, this.lavaDamageTimer - LAVA_DAMAGE_INTERVAL);
      }
    } else {
      this.lavaDamageTimer = 0;
    }

    if (isInFire && doFireDamage && !fireImmune) {
      this.fireDamageTimer += dt;
      const contactDamage = isSoulFire ? 4 : 2;
      while (this.fireDamageTimer + TIMER_EPSILON >= FIRE_CONTACT_DAMAGE_INTERVAL) {
        damage(contactDamage, 'fire');
        this.fireDamageTimer = Math.max(0, this.fireDamageTimer - FIRE_CONTACT_DAMAGE_INTERVAL);
      }
    } else {
      this.fireDamageTimer = 0;
    }`;
  s = replaceOnce(s, oldFire, newFire, 'persistent burning model');

  s = replaceOnce(s,
`  resetFall() {
    this.wasFalling = false;
  }`,
`  getRemainingFireSeconds() {
    return this.remainingFireSeconds;
  }

  resetFall() {
    this.wasFalling = false;
  }`, 'burn state query');

  write(path, s);
}

{
  const path = 'tests/survival-parity.test.ts';
  let s = read(path);
  s = replaceOnce(s,
`import { SurvivalSystem, shouldConsumeAir } from '../src/systems/SurvivalSystem';`,
`import { SurvivalSystem, getIgnitionSeconds, shouldConsumeAir } from '../src/systems/SurvivalSystem';`, 'burn helper import');

  s = replaceOnce(s,
`test('standing inside fire deals one heart every half second', () => {
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
});`,
`test('standing inside fire deals one heart every half second', () => {
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
  assert.equal(system.getRemainingFireSeconds(), 8);
});

test('soul fire deals twice normal fire contact damage', () => {
  const soulFireId = BlockRegistry.getByName('soul_fire')?.id;
  assert.ok(soulFireId !== undefined, 'soul fire block is registered');
  const system = new SurvivalSystem();
  const player = makePlayer();
  const damage: Array<[number, string]> = [];
  system.update(0.5, player, 'survival', (_x, y) => y === 64 ? soulFireId! : 0, (amount, type) => damage.push([amount, type]), 'normal', defaultRules);
  assert.deepEqual(damage, [[4, 'fire']]);
});

test('leaving fire keeps the player burning at one-heart-per-second cadence', () => {
  const fireId = BlockRegistry.getByName('fire')?.id;
  assert.ok(fireId !== undefined);
  const system = new SurvivalSystem();
  const player = makePlayer();
  const damage: Array<[number, string]> = [];
  system.update(0.05, player, 'survival', (_x, y) => y === 64 ? fireId! : 0, () => {}, 'normal', defaultRules);
  system.update(0.99, player, 'survival', noBlocks, (amount, type) => damage.push([amount, type]), 'normal', defaultRules);
  assert.deepEqual(damage, []);
  system.update(0.01, player, 'survival', noBlocks, (amount, type) => damage.push([amount, type]), 'normal', defaultRules);
  assert.deepEqual(damage, [[2, 'fire']]);
});

test('Fire Protection IV cuts ignition duration by sixty percent in Java 1.20.1', () => {
  assert.equal(getIgnitionSeconds(8, 4), 3.2);
  assert.equal(getIgnitionSeconds(15, 4), 6);
});

test('lava sets the fifteen-second burn timer while keeping its contact damage cadence', () => {
  const system = new SurvivalSystem();
  const player = makePlayer();
  const damage: Array<[number, string]> = [];
  system.update(0.5, player, 'survival', () => 10, (amount, type) => damage.push([amount, type]), 'normal', defaultRules);
  assert.deepEqual(damage, [[4, 'lava']]);
  assert.equal(system.getRemainingFireSeconds(), 15);
});

test('water extinguishes persistent burning immediately', () => {
  const fireId = BlockRegistry.getByName('fire')?.id;
  assert.ok(fireId !== undefined);
  const system = new SurvivalSystem();
  const player = makePlayer();
  system.update(0.05, player, 'survival', (_x, y) => y === 64 ? fireId! : 0, () => {}, 'normal', defaultRules);
  assert.equal(system.getRemainingFireSeconds(), 8);
  system.update(0.05, player, 'survival', () => 8, () => {}, 'normal', defaultRules);
  assert.equal(system.getRemainingFireSeconds(), 0);
});`, 'persistent burn tests');
  write(path, s);
}

console.log('persistent fire/lava burning parity applied');
