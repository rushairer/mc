export type PotionEffectId = 'healing' | 'regeneration' | 'speed' | 'fire_resistance' | 'poison' | 'wither';

export interface PotionEffectData {
  id: PotionEffectId;
  level: number;
  duration: number;
}

export interface ActivePotionEffect extends PotionEffectData {
  remaining: number;
}

const EFFECT_NAMES: Record<PotionEffectId, string> = {
  healing: 'Healing',
  regeneration: 'Regeneration',
  speed: 'Speed',
  fire_resistance: 'Fire Resistance',
  poison: 'Poison',
  wither: 'Wither',
};

export const PotionEffects = {
  getName(id: PotionEffectId): string {
    return EFFECT_NAMES[id] ?? id;
  },

  format(effect: PotionEffectData | ActivePotionEffect): string {
    const suffix = effect.level > 1 ? ` II` : '';
    return `${this.getName(effect.id)}${suffix}`;
  },

  isInstant(effect: PotionEffectData): boolean {
    return effect.id === 'healing';
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

      if (effect.id === 'regeneration') {
        this.tickTimers.regeneration = (this.tickTimers.regeneration ?? 0) + dt;
        if (this.tickTimers.regeneration >= 2.0) {
          this.tickTimers.regeneration = 0;
          heal(effect.level);
        }
      } else if (effect.id === 'poison') {
        this.tickTimers.poison = (this.tickTimers.poison ?? 0) + dt;
        if (this.tickTimers.poison >= 2.0) {
          this.tickTimers.poison = 0;
          damage(effect.level);
        }
      } else if (effect.id === 'wither') {
        this.tickTimers.wither = (this.tickTimers.wither ?? 0) + dt;
        if (this.tickTimers.wither >= 2.0) {
          this.tickTimers.wither = 0;
          damage(effect.level, true);
        }
      }
    }
  }

  getSpeedMultiplier(): number {
    const speed = this.effects.find((entry) => entry.id === 'speed');
    return speed ? 1 + speed.level * 0.2 : 1;
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
