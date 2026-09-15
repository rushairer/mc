import type { Player } from '../player/Player';
import { WALK_SPEED } from '../constants';

const EXHAUSTION_UNIT = 4.0;
const HEAL_EXHAUSTION_PER_HP = 6.0;
const FAST_REGEN_INTERVAL = 0.5;
const SLOW_REGEN_INTERVAL = 4.0;
const MAX_AIR_SECONDS = 15.0;
const AIR_REFILL_MULTIPLIER = 4.0;
const DROWNING_DAMAGE_INTERVAL = 1.0;

export class SurvivalSystem {
  private fallStartY = 0;
  private wasFalling = false;
  private starvationTimer = 0;
  private regenTimer = 0;
  private exhaustion = 0;
  private wasOnGround = true;
  private drownTimer = 0;
  private fireDamageTimer = 0;
  private lastPlayerX: number | null = null;
  private lastPlayerZ: number | null = null;

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
      this.drownTimer = 0;
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
    while (this.exhaustion >= EXHAUSTION_UNIT) {
      this.exhaustion -= EXHAUSTION_UNIT;
      if (player.saturation > 0) {
        player.saturation = Math.max(0, player.saturation - 1);
      } else if (difficulty !== 'peaceful') {
        player.hunger = Math.max(0, player.hunger - 1);
      }
    }

    // ─── Peaceful regeneration ───
    if (difficulty === 'peaceful') {
      if (player.health < 20) {
        this.regenTimer += dt;
        if (this.regenTimer >= 0.5) {
          player.health = Math.min(20, player.health + 1);
          this.regenTimer -= 0.5;
        }
      } else {
        this.regenTimer = 0;
      }
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
        const fallDamage = Math.floor(reduced);
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

    if (isUnderwater) {
      const respiration = Math.max(0, getEnchantLevel('respiration'));
      const canBreathe = hasEffect('water_breathing');
      if (!canBreathe) {
        // Respiration is probabilistic in vanilla. A deterministic equivalent uses
        // its expected drain rate: level N extends average air time by N + 1.
        const drainRate = 1 / (respiration + 1);
        player.oxygen = Math.max(0, player.oxygen - dt * drainRate);

        if (player.oxygen <= 0) {
          this.drownTimer += dt;
          if (this.drownTimer >= DROWNING_DAMAGE_INTERVAL) {
            damage(2, 'drown');
            this.drownTimer -= DROWNING_DAMAGE_INTERVAL;
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
    }

    // ─── Lava / Fire Damage ───
    const footBlock = getBlock(
      Math.floor(player.position.x),
      Math.floor(player.position.y),
      Math.floor(player.position.z)
    );
    const isFootLava = (footBlock & 0x3FF) === 10 || (footBlock & 0x3FF) === 11;
    const isHeadLava = (headBlock & 0x3FF) === 10 || (headBlock & 0x3FF) === 11;
    const doFireDamage = gamerules ? gamerules.getRule('fireDamage') : true;

    if ((isFootLava || isHeadLava) && doFireDamage) {
      if (!hasEffect('fire_resistance')) {
        this.fireDamageTimer += dt;
        if (this.fireDamageTimer >= 0.5) {
          damage(4, 'lava');
          this.fireDamageTimer -= 0.5;
        }
      }
    } else {
      this.fireDamageTimer = 0;
    }

    // ─── Starvation ───
    if (difficulty !== 'peaceful') {
      if (player.hunger <= 0) {
        this.starvationTimer += dt;
        if (this.starvationTimer >= 4) {
          const limit = difficulty === 'easy' ? 10 : (difficulty === 'normal' ? 1 : 0);
          if (player.health > limit) {
            damage(1, 'starve');
          }
          this.starvationTimer -= 4;
        }
      } else {
        this.starvationTimer = 0;
      }
    }

    // ─── Natural Regeneration ───
    if (difficulty !== 'peaceful') {
      const naturalRegeneration = gamerules ? gamerules.getRule('naturalRegeneration') : true;
      if (naturalRegeneration && player.health < 20 && player.hunger >= 20 && player.saturation > 0) {
        this.regenTimer += dt;
        if (this.regenTimer >= FAST_REGEN_INTERVAL) {
          const fundedExhaustion = Math.min(player.saturation, HEAL_EXHAUSTION_PER_HP);
          player.health = Math.min(20, player.health + fundedExhaustion / HEAL_EXHAUSTION_PER_HP);
          this.exhaustion += fundedExhaustion;
          this.regenTimer -= FAST_REGEN_INTERVAL;
        }
      } else if (naturalRegeneration && player.health < 20 && player.hunger >= 18) {
        this.regenTimer += dt;
        if (this.regenTimer >= SLOW_REGEN_INTERVAL) {
          player.health = Math.min(20, player.health + 1);
          this.exhaustion += HEAL_EXHAUSTION_PER_HP;
          this.regenTimer -= SLOW_REGEN_INTERVAL;
        }
      } else {
        this.regenTimer = 0;
      }
    }
  }

  resetFall() {
    this.wasFalling = false;
  }
}
