export type ServerBundleAction =
  | { action: 'drop_one'; bundleSlot: number; selectedIndex: number }
  | { action: 'insert_from_slot'; bundleSlot: number; sourceSlot: number }
  | { action: 'extract_to_inventory'; bundleSlot: number; selectedIndex: number };

function validInventorySlot(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < 36;
}

function validSelectedIndex(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < 64;
}

export function parseServerBundleAction(payload: unknown): ServerBundleAction | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  if (!validInventorySlot(raw.bundleSlot)) return null;

  if (raw.action === 'insert_from_slot') {
    if (!validInventorySlot(raw.sourceSlot) || raw.sourceSlot === raw.bundleSlot) return null;
    return {
      action: 'insert_from_slot',
      bundleSlot: Number(raw.bundleSlot),
      sourceSlot: Number(raw.sourceSlot),
    };
  }

  if (raw.action === 'drop_one' || raw.action === 'extract_to_inventory') {
    if (!validSelectedIndex(raw.selectedIndex)) return null;
    return {
      action: raw.action,
      bundleSlot: Number(raw.bundleSlot),
      selectedIndex: Number(raw.selectedIndex),
    };
  }
  return null;
}
