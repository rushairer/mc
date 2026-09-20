import type { ItemStack } from '../types';
import {
  cloneItemStack,
  getItemStackMaxSize,
  isValidItemStack,
  itemStacksCanMerge,
} from '../items/ItemStackRules';

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
export type ContainerClickButton = 'left' | 'right';

export interface ContainerClickIntent {
  area: ContainerArea;
  slotIndex: number;
  button?: ContainerClickButton;
  shift?: boolean;
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

const cloneStack = cloneItemStack;
export const canStacksMerge = itemStacksCanMerge;

function isWellFormedStack(stack: ItemStack | null): boolean {
  return stack === null || isValidItemStack(stack);
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
    const maxStack = getItemStackMaxSize(heldItem);
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
  if (raw.button !== undefined && raw.button !== 'left' && raw.button !== 'right') return null;
  if (raw.shift !== undefined && typeof raw.shift !== 'boolean') return null;

  const intent: ContainerClickIntent = { area: raw.area, slotIndex };
  if (raw.button === 'left' || raw.button === 'right') intent.button = raw.button;
  if (typeof raw.shift === 'boolean') intent.shift = raw.shift;
  return intent;
}

function cloneTransactionState(state: ContainerTransactionState): ContainerTransactionState {
  return {
    containerSlots: state.containerSlots.map((slot) => cloneStack(slot)),
    playerSlots: state.playerSlots.map((slot) => cloneStack(slot)),
    cursor: cloneStack(state.cursor),
  };
}

function getIntentSlots(
  state: ContainerTransactionState,
  area: ContainerArea,
): (ItemStack | null)[] {
  return area === 'container' ? state.containerSlots : state.playerSlots;
}

function applyServerLeftClick(
  state: ContainerTransactionState,
  intent: ContainerClickIntent,
): ContainerTransactionState {
  const next = cloneTransactionState(state);
  const slots = getIntentSlots(next, intent.area);
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
    const maxStack = getItemStackMaxSize(slot);
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

function applyServerRightClick(
  state: ContainerTransactionState,
  intent: ContainerClickIntent,
): ContainerTransactionState {
  const next = cloneTransactionState(state);
  const slots = getIntentSlots(next, intent.area);
  const slot = slots[intent.slotIndex];
  const cursor = next.cursor;

  if (!cursor && slot) {
    const pickedCount = Math.ceil(slot.count / 2);
    const remaining = slot.count - pickedCount;
    next.cursor = { ...slot, count: pickedCount };
    slots[intent.slotIndex] = remaining > 0 ? { ...slot, count: remaining } : null;
    return next;
  }

  if (!cursor) return next;

  if (!slot) {
    slots[intent.slotIndex] = { ...cursor, count: 1 };
    const remaining = cursor.count - 1;
    next.cursor = remaining > 0 ? { ...cursor, count: remaining } : null;
    return next;
  }

  if (!canStacksMerge(slot, cursor)) return next;
  const maxStack = getItemStackMaxSize(slot);
  if (slot.count >= maxStack) return next;

  slots[intent.slotIndex] = { ...slot, count: slot.count + 1 };
  const remaining = cursor.count - 1;
  next.cursor = remaining > 0 ? { ...cursor, count: remaining } : null;
  return next;
}

function destinationOrderForPlayerInventory(length: number): number[] {
  const mainEnd = Math.min(length, 36);
  const main = Array.from({ length: Math.max(0, mainEnd - 9) }, (_, i) => i + 9);
  const hotbar = Array.from({ length: Math.min(9, length) }, (_, i) => i);
  return [...main, ...hotbar];
}

function insertStackIntoIndices(
  slots: (ItemStack | null)[],
  stack: ItemStack,
  indices: number[],
): ItemStack | null {
  let remaining = stack.count;

  for (const index of indices) {
    if (remaining <= 0) break;
    if (!Number.isInteger(index) || index < 0 || index >= slots.length) continue;
    const target = slots[index];
    if (!target || !canStacksMerge(target, stack)) continue;
    const maxStack = getItemStackMaxSize(target);
    if (target.count >= maxStack) continue;
    const moved = Math.min(remaining, maxStack - target.count);
    slots[index] = { ...target, count: target.count + moved };
    remaining -= moved;
  }

  const sourceMax = getItemStackMaxSize(stack);
  for (const index of indices) {
    if (remaining <= 0) break;
    if (!Number.isInteger(index) || index < 0 || index >= slots.length || slots[index]) continue;
    const moved = Math.min(remaining, sourceMax);
    const placed = cloneStack(stack)!;
    placed.count = moved;
    slots[index] = placed;
    remaining -= moved;
  }

  if (remaining <= 0) return null;
  const remainder = cloneStack(stack)!;
  remainder.count = remaining;
  return remainder;
}

function applyServerQuickMove(
  state: ContainerTransactionState,
  intent: ContainerClickIntent,
): ContainerTransactionState {
  const next = cloneTransactionState(state);
  const sourceSlots = getIntentSlots(next, intent.area);
  const source = sourceSlots[intent.slotIndex];
  if (!source) return next;

  const destinationSlots = intent.area === 'container' ? next.playerSlots : next.containerSlots;
  const destinationIndices = intent.area === 'container'
    ? destinationOrderForPlayerInventory(destinationSlots.length)
    : Array.from({ length: destinationSlots.length }, (_, i) => i);

  const remainder = insertStackIntoIndices(destinationSlots, source, destinationIndices);
  sourceSlots[intent.slotIndex] = remainder;
  return next;
}

/**
 * Apply one server-authoritative container interaction using only server-owned
 * slots and cursor. The client supplies intent only; it never supplies stacks.
 */
export function applyServerContainerClick(
  state: ContainerTransactionState,
  intent: ContainerClickIntent,
): ContainerTransactionState | null {
  const sourceSlots = getIntentSlots(state, intent.area);
  if (!Number.isInteger(intent.slotIndex) || intent.slotIndex < 0 || intent.slotIndex >= sourceSlots.length) return null;

  if (intent.shift) return applyServerQuickMove(state, intent);
  if ((intent.button ?? 'left') === 'right') return applyServerRightClick(state, intent);
  return applyServerLeftClick(state, intent);
}

/** Return the server cursor to inventory on close; any remainder stays on cursor. */
export function returnContainerCursorToInventory(state: ContainerTransactionState): ContainerTransactionState {
  const next = cloneTransactionState(state);
  if (!next.cursor) return next;

  let remaining = next.cursor.count;
  const cursor = next.cursor;
  const maxStack = getItemStackMaxSize(cursor);

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
