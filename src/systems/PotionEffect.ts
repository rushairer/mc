export type PotionEffectId =
  | 'healing' | 'regeneration' | 'speed' | 'fire_resistance' | 'poison'
  | 'wither' | 'levitation'
  | 'strength' | 'weakness' | 'slowness' | 'hunger' | 'jump_boost'
  | 'water_breathing' | 'absorption' | 'resistance';

export interface PotionEffectData {
  id: PotionEffectId;
  level: number;
  duration: number;
}

export interface ActivePotionEffect extends PotionEffectData {
  remaining: number;
}

export interface EffectDef {
  name: string;
  /** Applied once on apply() (healing); no duration ticking. */
  instant?: boolean;
  /** Seconds between periodic ticks (regeneration/poison/wither). */
  tickInterval?: number;
  /** HP healed per tick. */
  tickHeal?: number;
  /** HP damaged per tick. */
  tickDamage?: number;
  /** Damage bypasses the "non-lethal" guard (wither). */
  lethalDamage?: boolean;
}

/** P3.3 — data-driven effect registry (Java 1.20.1 values). */
export const EFFECT_DEFS: Record<PotionEffectId, EffectDef> = {
  healing: { name: 'Healing', instant: true },
  regeneration: { name: 'Regeneration', tickInterval: 2.0, tickHeal: 1 },
  speed: { name: 'Speed' },
  fire_resistance: { name: 'Fire Resistance' },
  poison: { name: 'Poison', tickInterval: 2.0, tickDamage: 1 },
  wither: { name: 'Wither', tickInterval: 2.0, tickDamage: 1, lethalDamage: true },
  levitation: { name: 'Levitation' },
  strength: { name: 'Strength' },
  weakness: { name: 'Weakness' },
  slowness: { name: 'Slowness' },
  hunger: { name: 'Hunger', tickInterval: 4.0 },
  jump_boost: { name: 'Jump Boost' },
  water_breathing: { name: 'Water Breathing' },
  absorption: { name: 'Absorption' },
  resistance: { name: 'Resistance' },
};

/** Undead mobs targeted by Smite. */
export const UNDEAD_MOB_TYPES = new Set(['zombie', 'skeleton', 'wither_skeleton', 'zombie_pigman', 'wither']);

export const PotionEffects = {
  getName(id: PotionEffectId): string {
    return EFFECT_DEFS[id]?.name ?? id;
  },

  format(effect: PotionEffectData | ActivePotionEffect): string {
    const suffix = effect.level > 1 ? ` II` : '';
    return `${this.getName(effect.id)}${suffix}`;
  },

  isInstant(effect: PotionEffectData): boolean {
    return EFFECT_DEFS[effect.id]?.instant ?? false;
  },

  /** Melee damage modifier: Strength +3/level, Weakness -4/level (1.20.1). */
  getMeleeDamageModifier(strengthLevel: number, weaknessLevel: number): number {
    return strengthLevel * 3 - weaknessLevel * 4;
  },

  /** Movement speed multiplier: Speed +20%/level, Slowness -15%/level. */
  getSpeedMultiplier(speedLevel: number, slownessLevel: number): number {
    return (1 + speedLevel * 0.2) * Math.max(0.1, 1 - slownessLevel * 0.15);
  },

  /** Resistance reduces all damage by 20% per level (capped 80%). */
  getResistanceReduction(level: number): number {
    return Math.min(0.8, level * 0.2);
  },
};

export class PotionEffectSystem {
  private effects: ActivePotionEffect[] = [];
  private tickTimers: Partial<Record<PotionEffectId, number>> = {};

  apply(effect: PotionEffectData, heal: (amount: number) => void) {
    if (PotionEffects.isInstant(effect)) {
      heal(4 * effect.level);
      return;
    }

    const existing = this.effects.find((entry) => entry.id === effect.id);
    if (existing) {
      existing.level = Math.max(existing.level, effect.level);
      existing.duration = Math.max(existing.duration, effect.duration);
      existing.remaining = Math.max(existing.remaining, effect.duration);
    } else {
      this.effects.push({ ...effect, remaining: effect.duration });
    }
  }

  update(dt: number, heal: (amount: number) => void, damage: (amount: number, lethal?: boolean) => void) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.remaining -= dt;
      if (effect.remaining <= 0) {
        this.effects.splice(i, 1);
        this.tickTimers[effect.id] = 0;
        continue;
      }

      const def = EFFECT_DEFS[effect.id];
      if (!def?.tickInterval) continue;

      const timer = (this.tickTimers[effect.id] ?? 0) + dt;
      if (timer < def.tickInterval) {
        this.tickTimers[effect.id] = timer;
        continue;
      }
      this.tickTimers[effect.id] = 0;
      if (def.tickHeal) heal(def.tickHeal * effect.level);
      if (def.tickDamage) damage(def.tickDamage * effect.level, !!def.lethalDamage);
    }
  }

  getSpeedMultiplier(): number {
    return PotionEffects.getSpeedMultiplier(
      this.getLevel('speed'),
      this.getLevel('slowness'),
    );
  }

  getLevel(id: PotionEffectId): number {
    return this.effects.find((entry) => entry.id === id)?.level ?? 0;
  }

  has(id: PotionEffectId): boolean {
    return this.effects.some((effect) => effect.id === id);
  }

  remove(id: PotionEffectId) {
    this.effects = this.effects.filter((effect) => effect.id !== id);
    this.tickTimers[id] = 0;
  }

  getEffects(): ActivePotionEffect[] {
    return this.effects.map((effect) => ({ ...effect }));
  }

  setEffects(effects: ActivePotionEffect[] | undefined) {
    this.effects = Array.isArray(effects)
      ? effects.filter((effect) => effect.remaining > 0).map((effect) => ({ ...effect }))
      : [];
    this.tickTimers = {};
  }

  clear() {
    this.effects = [];
    this.tickTimers = {};
  }
}
