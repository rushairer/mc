import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import {
  DYE_COLORS,
  EXPLORER_MAP_NAMES,
  type DyeColor,
} from './WildernessBound26_3';

export interface CushionPlacementPoint {
  x: number;
  y: number;
  z: number;
}

export interface CushionSeat extends CushionPlacementPoint {
  color: DyeColor;
  occupantId: string | null;
  supportKey: string;
}

export interface CushionPlacementRequest {
  hitX: number;
  hitZ: number;
  supportTopY: number;
  flatSurface: boolean;
  supportingBlock: boolean;
  color: DyeColor;
}

export interface CushionSeatResult {
  seated: boolean;
  reason?: 'missing' | 'occupied' | 'already_seated';
  position?: CushionPlacementPoint;
}

export const CUSHION_HAS_COLLISION_26_3 = false;
export const CUSHION_PISTON_REACTION_26_3 = 'block' as const;
export const CUSHION_DAMPENS_VIBRATIONS_26_3 = false;
export const CUSHION_DISMOUNT_HINT_26_3 = 'Press SHIFT to get up';

function positionKey(x: number, y: number, z: number): string {
  return `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
}

export function snapCushionPlacement(request: CushionPlacementRequest): CushionPlacementPoint | null {
  if (!request.flatSurface || !request.supportingBlock || !DYE_COLORS.includes(request.color)) return null;
  return {
    x: Math.floor(request.hitX) + 0.5,
    y: request.supportTopY,
    z: Math.floor(request.hitZ) + 0.5,
  };
}

/** Runtime model for Java 26.3 cushion placement and sitting semantics. */
export class CushionSeatSystem26_3 {
  private readonly seats = new Map<string, CushionSeat>();
  private readonly playerSeat = new Map<string, string>();

  place(request: CushionPlacementRequest, supportKey: string): CushionSeat | null {
    const point = snapCushionPlacement(request);
    if (!point) return null;
    const key = positionKey(point.x, point.y, point.z);
    if (this.seats.has(key)) return null;
    const seat: CushionSeat = { ...point, color: request.color, occupantId: null, supportKey };
    this.seats.set(key, seat);
    return { ...seat };
  }

  sit(playerId: string, point: CushionPlacementPoint): CushionSeatResult {
    if (this.playerSeat.has(playerId)) return { seated: false, reason: 'already_seated' };
    const key = positionKey(point.x, point.y, point.z);
    const seat = this.seats.get(key);
    if (!seat) return { seated: false, reason: 'missing' };
    if (seat.occupantId && seat.occupantId !== playerId) return { seated: false, reason: 'occupied' };
    seat.occupantId = playerId;
    this.playerSeat.set(playerId, key);
    return { seated: true, position: { x: seat.x, y: seat.y, z: seat.z } };
  }

  stand(playerId: string): boolean {
    const key = this.playerSeat.get(playerId);
    if (!key) return false;
    const seat = this.seats.get(key);
    if (seat?.occupantId === playerId) seat.occupantId = null;
    this.playerSeat.delete(playerId);
    return true;
  }

  remove(point: CushionPlacementPoint): CushionSeat | null {
    const key = positionKey(point.x, point.y, point.z);
    const seat = this.seats.get(key);
    if (!seat) return null;
    if (seat.occupantId) this.playerSeat.delete(seat.occupantId);
    this.seats.delete(key);
    return { ...seat };
  }

  breakUnsupported(supportKey: string): CushionSeat[] {
    const broken: CushionSeat[] = [];
    for (const [key, seat] of this.seats) {
      if (seat.supportKey !== supportKey) continue;
      if (seat.occupantId) this.playerSeat.delete(seat.occupantId);
      broken.push({ ...seat });
      this.seats.delete(key);
    }
    return broken;
  }

  getSeat(point: CushionPlacementPoint): CushionSeat | undefined {
    const seat = this.seats.get(positionKey(point.x, point.y, point.z));
    return seat ? { ...seat } : undefined;
  }

  isPlayerSitting(playerId: string): boolean {
    return this.playerSeat.has(playerId);
  }
}

export interface StrawBedUseOutcome26_3 {
  canSleep: boolean;
  destroyed: true;
  setsSpawn: false;
  sleptStatIncrement: number;
}

/** Tracks the dedicated Java 26.3 `sleep_in_straw_bed` statistic. */
export class StrawBedSession26_3 {
  private sleptCount = 0;

  use(dimension: string): StrawBedUseOutcome26_3 {
    const canSleep = dimension === 'overworld';
    if (canSleep) this.sleptCount++;
    return {
      canSleep,
      destroyed: true,
      setsSpawn: false,
      sleptStatIncrement: canSleep ? 1 : 0,
    };
  }

  getSleptCount(): number {
    return this.sleptCount;
  }
}

export function isWoolShapeVibrationDampener26_3(blockName: string): boolean {
  return DYE_COLORS.some(color =>
    blockName === `${color}_wool`
    || blockName === `${color}_wool_stairs`
    || blockName === `${color}_wool_slab`,
  );
}

export interface ShelfMushroomBounce26_3 {
  bounced: boolean;
  soundEvent?: 'block.shelf_mushroom.fall';
  verticalVelocity: number;
}

export function applyShelfMushroomBounce26_3(incomingVerticalVelocity: number, sneaking = false): ShelfMushroomBounce26_3 {
  if (sneaking || incomingVerticalVelocity >= 0) {
    return { bounced: false, verticalVelocity: incomingVerticalVelocity };
  }
  // Beds/slime-style restitution: preserve a modest fraction of downward speed.
  return {
    bounced: true,
    soundEvent: 'block.shelf_mushroom.fall',
    verticalVelocity: Math.abs(incomingVerticalVelocity) * 0.5,
  };
}

export function isExplorerMapItemName26_3(name: string): boolean {
  return EXPLORER_MAP_NAMES.includes(name as typeof EXPLORER_MAP_NAMES[number]);
}

export function isExplorerMapItemId26_3(itemId: number): boolean {
  const name = ItemRegistry.get(itemId)?.name;
  return !!name && isExplorerMapItemName26_3(name);
}

export function isExplorerMapCreativeVisible26_3(itemId: number): boolean {
  return !isExplorerMapItemId26_3(itemId);
}

export function canZoomMapStack26_3(stack: ItemStack): boolean {
  return !isExplorerMapItemId26_3(stack.id) && !!stack.map && !stack.map.locked && stack.map.scale < 4;
}

export function cloneExplorerMapStack26_3(stack: ItemStack): ItemStack | null {
  if (!isExplorerMapItemId26_3(stack.id) || !stack.map) return null;
  return {
    ...stack,
    count: 1,
    map: {
      ...stack.map,
      pixels: [...stack.map.pixels],
      playerMarker: { ...stack.map.playerMarker },
    },
  };
}

const LEGACY_EXPLORER_NAMES: Record<string, typeof EXPLORER_MAP_NAMES[number]> = {
  ocean_monument_explorer_map: 'ocean_monument_map',
  woodland_mansion_explorer_map: 'woodland_mansion_map',
  trial_chambers_explorer_map: 'buried_trial_chambers_map',
  jungle_pyramid_explorer_map: 'jungle_pyramid_map',
  swamp_hut_explorer_map: 'swamp_hut_map',
  ancient_city_map: 'buried_ancient_city_map',
  mineshaft_map: 'buried_mineshaft_map',
};

export function migrateLegacyExplorerMapName26_3(name: string): string {
  return LEGACY_EXPLORER_NAMES[name] ?? name;
}

export interface WildernessBoundTraderTrade26_3 {
  id: 'poplar_sapling' | 'shelf_mushroom';
  emeraldCost: number;
  outputName: string;
  outputCount: number;
}

export const WILDERNESS_BOUND_WANDERING_TRADER_TRADES_26_3: readonly WildernessBoundTraderTrade26_3[] = [
  { id: 'poplar_sapling', emeraldCost: 5, outputName: 'poplar_sapling', outputCount: 1 },
  { id: 'shelf_mushroom', emeraldCost: 1, outputName: 'shelf_mushroom', outputCount: 1 },
];

export function resolveWildernessBoundTraderTrades26_3(): Array<{
  id: string;
  input: { id: number; count: number };
  output: { id: number; count: number };
}> {
  const emerald = ItemRegistry.getByName('emerald');
  if (!emerald) return [];
  return WILDERNESS_BOUND_WANDERING_TRADER_TRADES_26_3.flatMap(trade => {
    const output = ItemRegistry.getByName(trade.outputName);
    if (!output) return [];
    return [{
      id: `wandering_trader_${trade.id}`,
      input: { id: emerald.id, count: trade.emeraldCost },
      output: { id: output.id, count: trade.outputCount },
    }];
  });
}
