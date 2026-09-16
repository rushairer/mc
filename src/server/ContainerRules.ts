import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';

/**
 * P5.3 — Server container rules (pure, testable).
 * The server owns container/player slots and the cursor; clients send only
 * click/open/close intents.
 */

export const CONTAINER_SIZES: Record<string, number> = {
  chest: 27,
  barrel: 27,
  hopper: 5,
};

export type ContainerArea = 'container' | 'player';

export interface ContainerClickIntent {
  area: ContainerArea;
  slotIndex: number;
}

export interface ContainerTransactionState {
  containerSlots: (ItemStack | null)[];
  playerSlots: (ItemStack | null)[];
  cursor: ItemStack | null;
}

export function containerKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/** Initialize a container's slot array for the given block name. */
export function createContainerSlots(name: string): (ItemStack | null)[] {
  const size = CONTAINER_SIZES[name] ?? 27;
  return new Array(size).fill(null);
}

function cloneStack(stack: ItemStack | null): ItemStack | null {
  if (!stack) return null;
  return {
    ...stack,
    enchantments: stack.enchantments?.map((enchantment) => ({ ...enchantment })),
  };
}

function stackIdentity(stack: ItemStack): string {
  const { count: _count, ...identity } = stack;
  return JSON.stringify(identity);
}

export function canStacksMerge(a: ItemStack | null | undefined, b: ItemStack | null | undefined): boolean {
  if (!a || !b || a.id !== b.id) return false;
  return stackIdentity(a) === stackIdentity(b);
}

function isWellFormedStack(stack: ItemStack | null): boolean {
  if (stack === null) return true;
  if (!Number.isInteger(stack.id) || stack.id <= 0 || !Number.isInteger(stack.count) || stack.count <= 0) return false;
  const def = ItemRegistry.get(stack.id);
  if (!def) return false;
  return stack.count <= def.maxStackSize;
}

/** Validate a container click: slot in range and held item well-formed. */
export function validateContainerClick(
  slotIndex: number,
  slots: (ItemStack | null)[],
  heldItem: ItemStack | null,
): boolean {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slots.length) return false;
  return isWellFormedStack(heldItem);
}

/** Validate a full container snapshot for persistence/recovery only. */
export function validateContainerSlots(slots: unknown, size: number): slots is (ItemStack | null)[] {
  if (!Array.isArray(slots) || slots.length !== size) return false;
  return slots.every((slot) => isWellFormedStack(slot as ItemStack | null));
}

/** Legacy pure helper retained for existing local/singleplayer callers. */
export function applyContainerClick(
  slots: (ItemStack | null)[],
  slotIndex: number,
  heldItem: ItemStack | null,
): (ItemStack | null)[] {
  const next = slots.map((slot) => cloneStack(slot));
  const previous = next[slotIndex];
  if (heldItem && previous && canStacksMerge(previous, heldItem)) {
    const maxStack = ItemRegistry.getMaxStackSize(heldItem.id);
    const moved = Math.min(heldItem.count, Math.max(0, maxStack - previous.count));
    next[slotIndex] = { ...previous, count: previous.count + moved };
    return next;
  }
  next[slotIndex] = cloneStack(heldItem);
  return next;
}

export function parseContainerClickIntent(payload: unknown): ContainerClickIntent | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  if (raw.area !== 'container' && raw.area !== 'player') return null;
  const slotIndex = Number(raw.slotIndex);
  if (!Number.isInteger(slotIndex) || slotIndex < 0) return null;
  return { area: raw.area, slotIndex };
}

/**
 * Apply one Java-style left click using only server-owned slots and cursor.
 * The client does not provide item data, so it cannot create or rewrite stacks.
 */
export function applyServerContainerClick(
  state: ContainerTransactionState,
  intent: ContainerClickIntent,
): ContainerTransactionState | null {
  const sourceSlots = intent.area === 'container' ? state.containerSlots : state.playerSlots;
  if (intent.slotIndex >= sourceSlots.length) return null;

  const next: ContainerTransactionState = {
    containerSlots: state.containerSlots.map((slot) => cloneStack(slot)),
    playerSlots: state.playerSlots.map((slot) => cloneStack(slot)),
    cursor: cloneStack(state.cursor),
  };
  const slots = intent.area === 'container' ? next.containerSlots : next.playerSlots;
  const slot = slots[intent.slotIndex];
  const cursor = next.cursor;

  if (!cursor && slot) {
    next.cursor = cloneStack(slot);
    slots[intent.slotIndex] = null;
    return next;
  }
  if (cursor && !slot) {
    slots[intent.slotIndex] = cloneStack(cursor);
    next.cursor = null;
    return next;
  }
  if (!cursor && !slot) return next;
  if (!cursor || !slot) return next;

  if (canStacksMerge(cursor, slot)) {
    const maxStack = ItemRegistry.getMaxStackSize(slot.id);
    const moved = Math.min(cursor.count, Math.max(0, maxStack - slot.count));
    if (moved <= 0) return next;
    slots[intent.slotIndex] = { ...slot, count: slot.count + moved };
    const remaining = cursor.count - moved;
    next.cursor = remaining > 0 ? { ...cursor, count: remaining } : null;
    return next;
  }

  slots[intent.slotIndex] = cloneStack(cursor);
  next.cursor = cloneStack(slot);
  return next;
}

/** Return the server cursor to inventory on close; any remainder stays on cursor. */
export function returnContainerCursorToInventory(state: ContainerTransactionState): ContainerTransactionState {
  const next: ContainerTransactionState = {
    containerSlots: state.containerSlots.map((slot) => cloneStack(slot)),
    playerSlots: state.playerSlots.map((slot) => cloneStack(slot)),
    cursor: cloneStack(state.cursor),
  };
  if (!next.cursor) return next;

  let remaining = next.cursor.count;
  const cursor = next.cursor;
  const maxStack = ItemRegistry.getMaxStackSize(cursor.id);

  for (let i = 0; i < next.playerSlots.length && remaining > 0; i++) {
    const slot = next.playerSlots[i];
    if (!slot || !canStacksMerge(slot, cursor) || slot.count >= maxStack) continue;
    const moved = Math.min(remaining, maxStack - slot.count);
    next.playerSlots[i] = { ...slot, count: slot.count + moved };
    remaining -= moved;
  }
  for (let i = 0; i < next.playerSlots.length && remaining > 0; i++) {
    if (next.playerSlots[i]) continue;
    const moved = Math.min(remaining, maxStack);
    next.playerSlots[i] = { ...cursor, count: moved };
    remaining -= moved;
  }

  next.cursor = remaining > 0 ? { ...cursor, count: remaining } : null;
  return next;
}
