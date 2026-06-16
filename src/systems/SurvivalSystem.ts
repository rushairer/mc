import { BlockRegistry } from '../world/BlockRegistry';

const TICK_INTERVAL = 0.05; // 20 ticks/sec
const DROWNING_TICKS = 60; // 3 seconds underwater before damage

export class SurvivalSystem {
  private fallStartY = 0;
  private wasFalling = false;
  private underwaterTicks = 0;
  private starvationTimer = 0;

  update(dt: number, player: {
    position: { x: number; y: number; z: number };
    velocity: { y: number };
    onGround: boolean;
    health: number;
    hunger: number;
    flying: boolean;
  }, getBlock: (x: number, y: number, z: number) => number, damage: (amount: number) => void) {
    if (player.flying) return;

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
      // Simplified: regen 1 HP every 4 seconds when well-fed
      // This would need a proper timer; skipping for now to avoid over-complication
    }
  }

  resetFall() {
    this.wasFalling = false;
  }
}
