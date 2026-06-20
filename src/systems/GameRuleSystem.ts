export type Difficulty = 'peaceful' | 'easy' | 'normal' | 'hard';

export interface GameRules {
  keepInventory: boolean;
  doMobSpawning: boolean;
  doDaylightCycle: boolean;
  doWeatherCycle: boolean;
  fallDamage: boolean;
  fireDamage: boolean;
  mobGriefing: boolean;
}

export class GameRuleSystem {
  private difficulty: Difficulty = 'normal';
  private rules: GameRules = {
    keepInventory: false,
    doMobSpawning: true,
    doDaylightCycle: true,
    doWeatherCycle: true,
    fallDamage: true,
    fireDamage: true,
    mobGriefing: true,
  };

  constructor(saved?: { difficulty: Difficulty; rules: Partial<GameRules> }) {
    if (saved) {
      if (saved.difficulty) this.difficulty = saved.difficulty;
      if (saved.rules) {
        this.rules = { ...this.rules, ...saved.rules };
      }
    }
  }

  setDifficulty(diff: Difficulty) {
    this.difficulty = diff;
  }

  getDifficulty(): Difficulty {
    return this.difficulty;
  }

  setRule<K extends keyof GameRules>(ruleName: K, value: GameRules[K]) {
    this.rules[ruleName] = value;
  }

  getRule<K extends keyof GameRules>(ruleName: K): GameRules[K] {
    return this.rules[ruleName];
  }

  getRules(): GameRules {
    return { ...this.rules };
  }

  adjustDamageForDifficulty(baseDamage: number, isHostile: boolean): number {
    if (!isHostile) return baseDamage;
    if (this.difficulty === 'peaceful') return 0;
    if (this.difficulty === 'easy') return Math.max(1, Math.floor(baseDamage * 0.5));
    if (this.difficulty === 'normal') return baseDamage;
    if (this.difficulty === 'hard') return Math.max(1, Math.floor(baseDamage * 1.5));
    return baseDamage;
  }

  toJSON() {
    return {
      difficulty: this.difficulty,
      rules: this.rules,
    };
  }

  fromJSON(data: any) {
    if (!data) return;
    if (data.difficulty) this.difficulty = data.difficulty;
    if (data.rules) {
      this.rules = { ...this.rules, ...data.rules };
    }
  }
}
