import type { BlockFacing, BlockMetadata } from '../types';

export type OpenableKind = 'door' | 'trapdoor' | 'fence_gate';

const normalize = (rawName: string) => rawName.toLowerCase().replace(/^minecraft:/, '');

export function getOpenableKind(rawName: string): OpenableKind | undefined {
  const name = normalize(rawName);
  if (name.includes('trapdoor')) return 'trapdoor';
  if (name.includes('fence_gate')) return 'fence_gate';
  if (name === 'door' || name === 'wooden_door' || name === 'iron_door' || name.endsWith('_door')) return 'door';
  return undefined;
}

/** Iron doors/trapdoors are redstone-only; other vanilla openables can be used by hand. */
export function canHandToggleOpenable(rawName: string): boolean {
  const name = normalize(rawName);
  const kind = getOpenableKind(name);
  if (!kind) return false;
  return name !== 'iron_door' && name !== 'iron_trapdoor';
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

const horizontalFacing = (facing: BlockFacing | undefined): Exclude<BlockFacing, 'up' | 'down'> =>
  facing === 'south' || facing === 'east' || facing === 'west' ? facing : 'north';

const opposite: Record<Exclude<BlockFacing, 'up' | 'down'>, Exclude<BlockFacing, 'up' | 'down'>> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

export interface FenceGateManualState {
  open: boolean;
  facing: Exclude<BlockFacing, 'up' | 'down'>;
}

/**
 * Opening a fence gate from its back flips the facing to the player's direction
 * so the gate opens away from the player, matching Java's FenceGateBlock use rule.
 */
export function resolveFenceGateManualToggle(
  metadata: Pick<BlockMetadata, 'open' | 'facing'> | undefined,
  playerFacing: BlockFacing,
): FenceGateManualState {
  const currentFacing = horizontalFacing(metadata?.facing);
  if (metadata?.open) return { open: false, facing: currentFacing };
  const playerHorizontal = horizontalFacing(playerFacing);
  return {
    open: true,
    facing: currentFacing === opposite[playerHorizontal] ? playerHorizontal : currentFacing,
  };
}
