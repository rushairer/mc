import { BlockRegistry } from '../world/BlockRegistry';
import { Player } from '../player/Player';
import { WALK_SPEED } from '../constants';

const DROWNING_TICKS = 60; // 3 seconds underwater before damage

export class SurvivalSystem {
  private fallStartY = 0;
  private wasFalling = false;
  private underwaterTicks = 0;
  private starvationTimer = 0;
  private regenTimer = 0;
  private exhaustion = 0;
  private wasOnGround = true;
  private drownTimer = 0;
  private fireDamageTimer = 0;

  update(
    dt: number,
    player: Player,
    gameMode: 'survival' | 'creative',
    getBlock: (x: number, y: number, z: number) => number,
    damage: (amount: number, type: 'fall' | 'drown' | 'starve' | 'fire' | 'lava' | 'magic') => void,
    difficulty: string = 'normal',
    gamerules: any = null
  ) {
    if (gameMode === 'creative') {
      player.health = 20;
      player.hunger = 20;
      player.saturation = 20;
      player.oxygen = 15.0;
      return;
    }

    if (player.flying) return;

    // ─── Peaceful Mode Handling ───
    if (difficulty === 'peaceful') {
      player.hunger = 20;
      player.saturation = 20;
      if (player.health < 20) {
        this.regenTimer += dt;
        if (this.regenTimer >= 0.5) { // Regenerate 1 HP every 0.5 seconds in peaceful
          player.health = Math.min(20, player.health + 1);
          this.regenTimer = 0;
        }
      } else {
        this.regenTimer = 0;
      }
    } else {
      // ─── Hunger / Exhaustion Decay (Only in Easy, Normal, Hard) ───
      // Jump exhaustion
      if (!player.onGround && this.wasOnGround && player.velocity.y > 0) {
        this.exhaustion += 0.2; // jumping adds exhaustion
      }
      this.wasOnGround = player.onGround;

      // Movement exhaustion
      const speedSq = player.velocity.x * player.velocity.x + player.velocity.z * player.velocity.z;
      if (player.onGround && speedSq > 0.1) {
        const isSprinting = speedSq > WALK_SPEED * WALK_SPEED + 1;
        if (isSprinting) {
          this.exhaustion += 0.1 * dt; // sprinting exhaustion
        } else {
          this.exhaustion += 0.02 * dt; // walking exhaustion
        }
      } else if (!player.onGround) {
        // falling/in-air movement
        this.exhaustion += 0.05 * dt;
      } else {
        this.exhaustion += 0.005 * dt; // standing still
      }

      // Process exhaustion to hunger decay
      if (this.exhaustion >= 4.0) {
        this.exhaustion -= 4.0;
        if (player.saturation > 0) {
          player.saturation = Math.max(0, player.saturation - 1);
        } else {
          player.hunger = Math.max(0, player.hunger - 1);
        }
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
        const fallDamage = Math.floor(fallDist - 3);
        damage(fallDamage, 'fall');
      }
      this.wasFalling = false;
    }

    // ─── Drowning ───
    const headBlock = getBlock(
      Math.floor(player.position.x),
      Math.floor(player.position.y + 1.62), // player eye/head height
      Math.floor(player.position.z)
    );
    const isUnderwater = (headBlock & 0x3FF) === 8 || (headBlock & 0x3FF) === 9; // flowing or still water

    if (isUnderwater) {
      // Consume oxygen
      player.oxygen = Math.max(0, player.oxygen - dt);

      // If oxygen is empty, take drowning damage every 1.5 seconds
      if (player.oxygen <= 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= 1.5) {
          damage(2, 'drown'); // 1 heart damage
          this.drownTimer = 0;
        }
      } else {
        this.drownTimer = 0;
      }
    } else {
      // Refill oxygen rapidly when out of water (full refill in 2 seconds)
      player.oxygen = Math.min(15.0, player.oxygen + dt * 7.5);
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
      this.fireDamageTimer += dt;
      if (this.fireDamageTimer >= 0.5) {
        damage(4, 'lava'); // 2 hearts damage every 0.5 seconds in lava
        this.fireDamageTimer = 0;
      }
    } else {
      this.fireDamageTimer = 0;
    }

    // ─── Starvation (Skip in Peaceful) ───
    if (difficulty !== 'peaceful') {
      if (player.hunger <= 0) {
        this.starvationTimer += dt;
        if (this.starvationTimer >= 4) { // damage every 4 seconds
          // In Easy, starve stops at 10 (5 hearts); in Normal, stops at 1 (half heart); in Hard, lethal (kills player)
          const limit = difficulty === 'easy' ? 10 : (difficulty === 'normal' ? 1 : 0);
          if (player.health > limit) {
            damage(1, 'starve');
          }
          this.starvationTimer = 0;
        }
      } else {
        this.starvationTimer = 0;
      }
    }

    // ─── Natural Regeneration (Skip in Peaceful because peaceful has its own faster regen) ───
    if (difficulty !== 'peaceful') {
      if (player.hunger >= 18 && player.health < 20) {
        this.regenTimer += dt;
        if (this.regenTimer >= 4.0) {
          player.health = Math.min(20, player.health + 1);
          this.regenTimer = 0;
          this.exhaustion += 3.0; // natural regen drains hunger/saturation
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
