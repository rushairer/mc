import type { Player } from '../player/Player';
import { WALK_SPEED } from '../constants';
import { BlockRegistry } from '../world/BlockRegistry';
import { XorShiftRandom } from '../engine/DeterministicRandom';

const EXHAUSTION_UNIT = 4.0;
const HEAL_EXHAUSTION_PER_HP = 6.0;
const FAST_REGEN_INTERVAL = 0.5;
const SLOW_REGEN_INTERVAL = 4.0;
const PEACEFUL_FOOD_INTERVAL = 0.5;
const PEACEFUL_HEALTH_INTERVAL = 1.0;
const MAX_AIR_SECONDS = 15.0;
const AIR_REFILL_MULTIPLIER = 4.0;
const GAME_TICK_SECONDS = 0.05;
const AIR_SECONDS_PER_TICK = 0.05;
const DROWNING_DRAIN_TICKS = 20;
const LAVA_DAMAGE_INTERVAL = 0.5;
const FIRE_CONTACT_DAMAGE_INTERVAL = 0.5;
const BURN_DAMAGE_INTERVAL = 1.0;
const FIRE_IGNITION_SECONDS = 8;
const LAVA_IGNITION_SECONDS = 15;
const FIRE_PROTECTION_BURN_REDUCTION_PER_LEVEL = 0.15;
const TIMER_EPSILON = 1e-9;

export interface AirRandomSource {
  nextInt(maxExclusive: number): number;
}

/** Java 1.20.1: Respiration level N skips air loss when nextInt(N + 1) > 0. */
export function shouldConsumeAir(respirationLevel: number, random: AirRandomSource): boolean {
  const level = Math.max(0, Math.floor(respirationLevel));
  return level === 0 || random.nextInt(level + 1) === 0;
}

export function getIgnitionSeconds(baseSeconds: number, fireProtectionLevel: number): number {
  const level = Math.max(0, Math.floor(fireProtectionLevel));
  const multiplier = Math.max(0, 1 - level * FIRE_PROTECTION_BURN_REDUCTION_PER_LEVEL);
  // Entity fire is stored in game ticks; floor to that 20 TPS precision.
  return Math.floor(baseSeconds * multiplier * 20 + TIMER_EPSILON) / 20;
}

export class SurvivalSystem {
  private fallStartY = 0;
  private wasFalling = false;
  private starvationTimer = 0;
  private regenTimer = 0;
  private peacefulFoodTimer = 0;
  private peacefulHealthTimer = 0;
  private exhaustion = 0;
  private wasOnGround = true;
  private airTickAccumulator = 0;
  private drowningDrainTicks = 0;
  private lavaDamageTimer = 0;
  private fireDamageTimer = 0;
  private burnDamageTimer = 0;
  private remainingFireSeconds = 0;
  private lastPlayerX: number | null = null;
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

  update(
    dt: number,
    player: Player,
    gameMode: 'survival' | 'creative',
    getBlock: (x: number, y: number, z: number) => number,
    damage: (amount: number, type: 'fall' | 'drown' | 'starve' | 'fire' | 'lava' | 'magic') => void,
    difficulty: string = 'normal',
    gamerules: any = null,
    hasEffect: (id: string) => boolean = () => false,
    getEnchantLevel: (id: string) => number = () => 0,
  ) {
    const horizontalDistance = this.lastPlayerX === null || this.lastPlayerZ === null
      ? 0
      : Math.hypot(player.position.x - this.lastPlayerX, player.position.z - this.lastPlayerZ);
    this.lastPlayerX = player.position.x;
    this.lastPlayerZ = player.position.z;

    if (gameMode === 'creative') {
      // Creative mode bypasses survival damage/food processing, but switching
      // modes must not silently overwrite the player's stored food state.
      player.oxygen = MAX_AIR_SECONDS;
      this.airTickAccumulator = 0;
      this.drowningDrainTicks = 0;
      this.remainingFireSeconds = 0;
      this.burnDamageTimer = 0;
      return;
    }

    if (player.flying) return;

    // ─── Hunger / Exhaustion ───
    // Vanilla does not charge exhaustion for standing still or ordinary walking.
    // Sprinting is distance-based (0.1 per metre), while jumping is event-based.
    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    const sprintThreshold = WALK_SPEED * Math.max(0.1, player.speedMultiplier) * 1.15;
    const isSprinting = horizontalSpeed > sprintThreshold;

    if (!player.onGround && this.wasOnGround && player.velocity.y > 0) {
      this.exhaustion += isSprinting ? 0.2 : 0.05;
    }
    this.wasOnGround = player.onGround;

    if (isSprinting && horizontalDistance > 0) {
      this.exhaustion += horizontalDistance * 0.1;
    }

    // Exhaustion is processed in Peaceful too, but Peaceful prevents the visible
    // food level itself from decreasing once saturation is empty.
    while (this.exhaustion + TIMER_EPSILON >= EXHAUSTION_UNIT) {
      this.exhaustion = Math.max(0, this.exhaustion - EXHAUSTION_UNIT);
      if (player.saturation > 0) {
        player.saturation = Math.max(0, player.saturation - 1);
      } else if (difficulty !== 'peaceful') {
        player.hunger = Math.max(0, player.hunger - 1);
      }
    }

    // ─── Peaceful regeneration ───
    // Java 1.20.1 restores food every 10 game ticks and health every 20 game
    // ticks while naturalRegeneration is enabled. Saturation is NOT restored in
    // 1.20.1; that behavior was added to Java later.
    if (difficulty === 'peaceful') {
      const naturalRegeneration = gamerules ? gamerules.getRule('naturalRegeneration') : true;
      if (naturalRegeneration) {
        if (player.hunger < 20) {
          this.peacefulFoodTimer += dt;
          while (this.peacefulFoodTimer + TIMER_EPSILON >= PEACEFUL_FOOD_INTERVAL && player.hunger < 20) {
            player.hunger = Math.min(20, player.hunger + 1);
            this.peacefulFoodTimer = Math.max(0, this.peacefulFoodTimer - PEACEFUL_FOOD_INTERVAL);
          }
        } else {
          this.peacefulFoodTimer = 0;
        }

        if (player.health < 20) {
          this.peacefulHealthTimer += dt;
          while (this.peacefulHealthTimer + TIMER_EPSILON >= PEACEFUL_HEALTH_INTERVAL && player.health < 20) {
            player.health = Math.min(20, player.health + 1);
            this.peacefulHealthTimer = Math.max(0, this.peacefulHealthTimer - PEACEFUL_HEALTH_INTERVAL);
          }
        } else {
          this.peacefulHealthTimer = 0;
        }
      } else {
        this.peacefulFoodTimer = 0;
        this.peacefulHealthTimer = 0;
      }
    } else {
      this.peacefulFoodTimer = 0;
      this.peacefulHealthTimer = 0;
    }

    // ─── Fall Damage ───
    const doFallDamage = gamerules ? gamerules.getRule('fallDamage') : true;

    if (!player.onGround && player.velocity.y < 0) {
      if (!this.wasFalling) {
        this.fallStartY = player.position.y;
        this.wasFalling = true;
      }
    }

    if (this.wasFalling && player.onGround) {
      const fallDist = this.fallStartY - player.position.y;
      if (fallDist > 3 && doFallDamage) {
        const featherReduction = getEnchantLevel('feather_falling');
        const reduced = Math.max(0, fallDist - 3) * (1 - Math.min(0.8, featherReduction * 0.12));
        const fallDamage = Math.ceil(reduced - TIMER_EPSILON);
        if (fallDamage > 0) {
          damage(fallDamage, 'fall');
        }
      }
      this.wasFalling = false;
    }

    // ─── Drowning ───
    const headBlock = getBlock(
      Math.floor(player.eyePosition.x),
      Math.floor(player.eyePosition.y),
      Math.floor(player.eyePosition.z)
    );
    const isUnderwater = (headBlock & 0x3FF) === 8 || (headBlock & 0x3FF) === 9;
    const doDrowningDamage = gamerules ? gamerules.getRule('drowningDamage') : true;

    if (isUnderwater) {
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
    }

    // ─── Lava / Fire Damage ───
    const footBlock = getBlock(
      Math.floor(player.position.x),
      Math.floor(player.position.y),
      Math.floor(player.position.z)
    );
    const isFootLava = (footBlock & 0x3FF) === 10 || (footBlock & 0x3FF) === 11;
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
    }

    // ─── Starvation ───
    if (difficulty !== 'peaceful') {
      if (player.hunger <= 0) {
        this.starvationTimer += dt;
        while (this.starvationTimer + TIMER_EPSILON >= 4) {
          const limit = difficulty === 'easy' ? 10 : (difficulty === 'normal' ? 1 : 0);
          if (player.health > limit) {
            damage(1, 'starve');
          }
          this.starvationTimer = Math.max(0, this.starvationTimer - 4);
        }
      } else {
        this.starvationTimer = 0;
      }
    } else {
      this.starvationTimer = 0;
    }

    // ─── Natural Regeneration ───
    if (difficulty !== 'peaceful') {
      const naturalRegeneration = gamerules ? gamerules.getRule('naturalRegeneration') : true;
      if (naturalRegeneration && player.health < 20 && player.hunger >= 20 && player.saturation > 0) {
        this.regenTimer += dt;
        if (this.regenTimer + TIMER_EPSILON >= FAST_REGEN_INTERVAL) {
          const fundedExhaustion = Math.min(player.saturation, HEAL_EXHAUSTION_PER_HP);
          player.health = Math.min(20, player.health + fundedExhaustion / HEAL_EXHAUSTION_PER_HP);
          this.exhaustion += fundedExhaustion;
          this.regenTimer = Math.max(0, this.regenTimer - FAST_REGEN_INTERVAL);
        }
      } else if (naturalRegeneration && player.health < 20 && player.hunger >= 18) {
        this.regenTimer += dt;
        if (this.regenTimer + TIMER_EPSILON >= SLOW_REGEN_INTERVAL) {
          player.health = Math.min(20, player.health + 1);
          this.exhaustion += HEAL_EXHAUSTION_PER_HP;
          this.regenTimer = Math.max(0, this.regenTimer - SLOW_REGEN_INTERVAL);
        }
      } else {
        this.regenTimer = 0;
      }
    }
  }

  getRemainingFireSeconds() {
    return this.remainingFireSeconds;
  }

  resetFall() {
    this.wasFalling = false;
  }
}
