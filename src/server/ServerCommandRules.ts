import type { ItemStack } from '../types';
import { cloneItemStack, itemStacksCanMerge } from '../items/ItemStackRules';

export const PRIVILEGED_SERVER_COMMANDS = new Set([
  'tp',
  'teleport',
  'setblock',
  'give',
  'time',
  'weather',
  'gamerule',
  'gamemode',
  'gm',
]);

export const MAX_GIVE_STACKS = 100;

export function normalizeCommandLabel(commandText: string): string {
  const trimmed = commandText.trim();
  if (!trimmed.startsWith('/')) return '';
  return trimmed.slice(1).split(/\s+/, 1)[0]?.toLowerCase() ?? '';
}

/** Multiplayer clients do not gain operator authority merely by sending slash commands. */
export function canExecuteServerCommand(commandText: string, isOperator: boolean): boolean {
  const label = normalizeCommandLabel(commandText);
  if (!label) return false;
  return isOperator && PRIVILEGED_SERVER_COMMANDS.has(label);
}

export function isValidWeatherArgument(value: unknown): value is 'clear' | 'rain' | 'thunder' {
  return value === 'clear' || value === 'rain' || value === 'thunder';
}

/**
 * Java 26.3 /give rejects amounts above 100 stacks instead of succeeding with
 * a zero-result error. The omitted count is one item, matching vanilla syntax.
 */
export function validateGiveCount(count: unknown, maxStackSize: number): number | null {
  const parsed = count === undefined ? 1 : Number(count);
  const stackSize = Math.max(1, Math.floor(maxStackSize));
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  if (parsed > stackSize * MAX_GIVE_STACKS) return null;
  return parsed;
}

export interface GiveInventoryResult {
  slots: Array<ItemStack | null>;
  remainder: number;
}

/** Fill compatible stacks first, then empty slots, without mutating input. */
export function applyGiveToInventory(
  input: Array<ItemStack | null>,
  itemId: number,
  count: number,
  maxStackSize: number,
): GiveInventoryResult {
  const slots = input.map((slot) => cloneItemStack(slot));
  const maxStack = Math.max(1, Math.floor(maxStackSize));
  const plainStack: ItemStack = { id: itemId, count: 1 };
  let remaining = Math.max(0, Math.floor(count));

  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const slot = slots[i];
    if (!slot || !itemStacksCanMerge(slot, plainStack) || slot.count >= maxStack) continue;
    const moved = Math.min(remaining, maxStack - slot.count);
    slot.count += moved;
    remaining -= moved;
  }

  for (let i = 0; i < slots.length && remaining > 0; i++) {
    if (slots[i]) continue;
    const moved = Math.min(remaining, maxStack);
    slots[i] = { id: itemId, count: moved };
    remaining -= moved;
  }

  return { slots, remainder: remaining };
}
