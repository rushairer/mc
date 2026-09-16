import { ItemRegistry, type ItemDef } from './ItemRegistry';
import { BlockRegistry } from '../world/BlockRegistry';
import type { BlockDef } from '../types';

export type ItemPresentationKind = 'block' | 'item';

export interface ItemPresentationIdentity {
  item?: ItemDef;
  block?: BlockDef;
  kind: ItemPresentationKind;
  registryName: string;
  displayName?: string;
  placeBlockId?: number;
}

function normalizeFallbackName(value = ''): string {
  return value
    .replace(/^minecraft:/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Resolve display/icon identity without relying on legacy numeric ID ranges. */
export function resolveItemPresentationIdentity(itemId: number, fallbackName?: string): ItemPresentationIdentity {
  const item = ItemRegistry.get(itemId);
  const placeBlockId = ItemRegistry.getPlaceBlockId(itemId);
  const block = placeBlockId !== undefined ? BlockRegistry.get(placeBlockId) : undefined;
  const kind: ItemPresentationKind = placeBlockId !== undefined ? 'block' : 'item';
  const registryName = (block?.name ?? item?.name ?? normalizeFallbackName(fallbackName)).replace(/^minecraft:/, '');
  return {
    item,
    block,
    kind,
    registryName,
    displayName: item?.displayName ?? block?.displayName ?? fallbackName,
    placeBlockId,
  };
}

export function getItemTranslationKey(itemId: number, fallbackName?: string): string {
  const identity = resolveItemPresentationIdentity(itemId, fallbackName);
  return identity.kind + '_' + identity.registryName;
}
