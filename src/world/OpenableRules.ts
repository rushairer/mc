import type { BlockMetadata } from '../types';

export type OpenableKind = 'door' | 'trapdoor' | 'fence_gate';

export function getOpenableKind(rawName: string): OpenableKind | undefined {
  const name = rawName.toLowerCase().replace(/^minecraft:/, '');
  if (name.includes('trapdoor')) return 'trapdoor';
  if (name.includes('fence_gate')) return 'fence_gate';
  if (name === 'door' || name === 'wooden_door' || name === 'iron_door' || name.endsWith('_door')) return 'door';
  return undefined;
}

export interface OpenableRedstoneState {
  changed: boolean;
  open: boolean;
  powered: boolean;
}

/**
 * Java openables only force their open state when the redstone-powered state
 * transitions. Re-evaluating an already-unpowered block must not erase a
 * player's manual open/closed choice.
 */
export function resolveOpenableRedstoneState(
  metadata: Pick<BlockMetadata, 'open' | 'powered'> | undefined,
  poweredNow: boolean,
): OpenableRedstoneState {
  const previousPowered = metadata?.powered ?? false;
  const currentOpen = metadata?.open ?? false;
  if (previousPowered === poweredNow) {
    return { changed: false, open: currentOpen, powered: previousPowered };
  }
  return { changed: true, open: poweredNow, powered: poweredNow };
}
