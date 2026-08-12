export type TickPriority = 'highest' | 'high' | 'normal' | 'low';

export interface ScheduledTick<TType extends string = string, TPayload = unknown> {
  id: string;
  type: TType;
  x: number;
  y: number;
  z: number;
  dimension: number;
  dueTick: number;
  priority: TickPriority;
  payload?: TPayload;
  order: number;
}

export interface ScheduleTickInput<TType extends string, TPayload> {
  type: TType;
  x: number;
  y: number;
  z: number;
  dimension?: number;
  delayTicks: number;
  priority?: TickPriority;
  payload?: TPayload;
}

export interface TickAdvanceResult<TType extends string, TPayload> {
  steps: number;
  due: ScheduledTick<TType, TPayload>[];
  currentTick: number;
  interpolation: number;
}

const PRIORITY_ORDER: Record<TickPriority, number> = {
  highest: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/** Deterministic fixed-step scheduler shared by block and simulation systems. */
export class TickScheduler<TType extends string = string, TPayload = unknown> {
  private accumulator = 0;
  private currentTick = 0;
  private nextOrder = 0;
  private readonly scheduled = new Map<string, ScheduledTick<TType, TPayload>>();

  constructor(
    readonly ticksPerSecond = 20,
    private readonly maxStepsPerAdvance = 100,
  ) {
    if (!Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0) {
      throw new Error('ticksPerSecond must be positive.');
    }
  }

  static positionKey(type: string, x: number, y: number, z: number, dimension = 0): string {
    return `${dimension}:${x},${y},${z}:${type}`;
  }

  schedule(input: ScheduleTickInput<TType, TPayload>): ScheduledTick<TType, TPayload> {
    const dimension = Number.isInteger(input.dimension) ? input.dimension! : 0;
    const x = Math.floor(input.x);
    const y = Math.floor(input.y);
    const z = Math.floor(input.z);
    const id = TickScheduler.positionKey(input.type, x, y, z, dimension);
    const dueTick = this.currentTick + Math.max(1, Math.floor(input.delayTicks));
    const existing = this.scheduled.get(id);
    if (existing && existing.dueTick <= dueTick) return existing;

    const scheduled: ScheduledTick<TType, TPayload> = {
      id,
      type: input.type,
      x,
      y,
      z,
      dimension,
      dueTick,
      priority: input.priority ?? 'normal',
      payload: input.payload,
      order: existing?.order ?? this.nextOrder++,
    };
    this.scheduled.set(id, scheduled);
    return scheduled;
  }

  cancel(type: TType, x: number, y: number, z: number, dimension = 0): boolean {
    return this.scheduled.delete(TickScheduler.positionKey(type, x, y, z, dimension));
  }

  has(type: TType, x: number, y: number, z: number, dimension = 0): boolean {
    return this.scheduled.has(TickScheduler.positionKey(type, x, y, z, dimension));
  }

  advance(deltaSeconds: number): TickAdvanceResult<TType, TPayload> {
    const safeDelta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    this.accumulator += safeDelta * this.ticksPerSecond;
    const availableSteps = Math.floor(this.accumulator);
    const steps = Math.min(availableSteps, this.maxStepsPerAdvance);
    this.accumulator -= steps;
    if (availableSteps > this.maxStepsPerAdvance) this.accumulator = 0;

    const due: ScheduledTick<TType, TPayload>[] = [];
    for (let step = 0; step < steps; step++) {
      this.currentTick++;
      for (const [id, scheduled] of this.scheduled) {
        if (scheduled.dueTick > this.currentTick) continue;
        due.push(scheduled);
        this.scheduled.delete(id);
      }
    }

    due.sort((left, right) =>
      left.dueTick - right.dueTick ||
      PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
      left.order - right.order,
    );

    return {
      steps,
      due,
      currentTick: this.currentTick,
      interpolation: Math.min(1, Math.max(0, this.accumulator)),
    };
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  getPendingTicks(): ScheduledTick<TType, TPayload>[] {
    return Array.from(this.scheduled.values()).sort((left, right) =>
      left.dueTick - right.dueTick ||
      PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
      left.order - right.order,
    );
  }

  restore(currentTick: number, scheduled: ScheduledTick<TType, TPayload>[]) {
    this.clear();
    this.currentTick = Math.max(0, Math.floor(currentTick));
    for (const entry of scheduled) {
      if (!entry || entry.dueTick <= this.currentTick || typeof entry.type !== 'string') continue;
      const id = TickScheduler.positionKey(entry.type, entry.x, entry.y, entry.z, entry.dimension);
      const existing = this.scheduled.get(id);
      if (existing && existing.dueTick <= entry.dueTick) continue;
      this.scheduled.set(id, { ...entry, id });
      this.nextOrder = Math.max(this.nextOrder, entry.order + 1);
    }
  }

  clear() {
    this.accumulator = 0;
    this.currentTick = 0;
    this.nextOrder = 0;
    this.scheduled.clear();
  }
}
