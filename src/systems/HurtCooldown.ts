const TOTAL_HURT_COOLDOWN_SECONDS = 20 / 20;
const ACTIVE_INVULNERABILITY_SECONDS = 10 / 20;
const EPSILON = 1e-9;

export interface HurtCooldownState {
  remainingSeconds: number;
  lastDamage: number;
}

export interface HurtResult {
  appliedDamage: number;
  next: HurtCooldownState;
  accepted: boolean;
}

export function createHurtCooldownState(): HurtCooldownState {
  return { remainingSeconds: 0, lastDamage: 0 };
}

export function tickHurtCooldown(state: HurtCooldownState, dt: number): HurtCooldownState {
  const nextRemaining = Math.max(0, state.remainingSeconds - Math.max(0, dt));
  return {
    remainingSeconds: nextRemaining < EPSILON ? 0 : nextRemaining,
    lastDamage: nextRemaining < EPSILON ? 0 : state.lastDamage,
  };
}

/**
 * Java LivingEntity hurt cooldown: a full hit starts a 20-tick timer. During
 * the first 10 ticks, equal/weaker hits are ignored and stronger hits apply
 * only the excess over the previous accepted raw damage.
 */
export function resolveHurtDamage(state: HurtCooldownState, incomingDamage: number): HurtResult {
  const incoming = Math.max(0, incomingDamage);
  if (incoming <= 0) {
    return { appliedDamage: 0, next: state, accepted: false };
  }

  if (state.remainingSeconds > ACTIVE_INVULNERABILITY_SECONDS + EPSILON) {
    if (incoming <= state.lastDamage + EPSILON) {
      return { appliedDamage: 0, next: state, accepted: false };
    }
    return {
      appliedDamage: incoming - state.lastDamage,
      next: { ...state, lastDamage: incoming },
      accepted: true,
    };
  }

  return {
    appliedDamage: incoming,
    next: {
      remainingSeconds: TOTAL_HURT_COOLDOWN_SECONDS,
      lastDamage: incoming,
    },
    accepted: true,
  };
}

export const HURT_COOLDOWN_TOTAL_SECONDS = TOTAL_HURT_COOLDOWN_SECONDS;
export const HURT_INVULNERABILITY_SECONDS = ACTIVE_INVULNERABILITY_SECONDS;
