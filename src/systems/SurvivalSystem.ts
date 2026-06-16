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

  update(
    dt: number,
    player: Player,
    getBlock: (x: number, y: number, z: number) => number,
    damage: (amount: number) => void
  ) {
    if (player.flying) return;

    // ─── Hunger / Exhaustion Decay ───
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

    // ─── Fall Damage ───
    if (!player.onGround && player.velocity.y < 0) {
      if (!this.wasFalling) {
        this.fallStartY = player.position.y;
        this.wasFalling = true;
      }
    }

    if (this.wasFalling && player.onGround) {
      const fallDist = this.fallStartY - player.position.y;
      if (fallDist > 3) {
        const fallDamage = Math.floor(fallDist - 3);
        damage(fallDamage);
      }
      this.wasFalling = false;
    }

    // ─── Drowning ───
    const headBlock = getBlock(
      Math.floor(player.position.x),
      Math.floor(player.position.y + 1.6),
      Math.floor(player.position.z)
    );
    const isUnderwater = headBlock === 13; // water

    if (isUnderwater) {
      this.underwaterTicks++;
      if (this.underwaterTicks >= DROWNING_TICKS) {
        damage(2);
        this.underwaterTicks = 0;
      }
    } else {
      this.underwaterTicks = 0;
    }

    // ─── Starvation ───
    if (player.hunger <= 0) {
      this.starvationTimer += dt;
      if (this.starvationTimer >= 4) { // damage every 4 seconds
        damage(1);
        this.starvationTimer = 0;
      }
    } else {
      this.starvationTimer = 0;
    }

    // ─── Natural Regeneration ───
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

  resetFall() {
    this.wasFalling = false;
  }
}
