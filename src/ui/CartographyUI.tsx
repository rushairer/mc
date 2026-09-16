import React, { useMemo, useState } from 'react';
import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory } from '../player/Inventory';
import { useI18n } from '../i18n';
import { isExplorerMapItemName26_3 } from '../world/WildernessBoundGameplay26_3';

interface CartographyUIProps {
  inventory: Inventory;
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
  /** Game-backed craft: returns the resulting map item or null. */
  onCraft: (mapItem: ItemStack, ingredient: ItemStack) => ItemStack | null;
}

const SLOT_SIZE = 48;
const FILLED_MAP_ID = 358;
const EMPTY_MAP_ID = 395;
const PAPER_ID = 339;
const GLASS_PANE_ID = 102;
const MAX_MAP_SCALE = 4;

export type CartographyAction = 'clone' | 'zoom' | 'lock' | null;

export function isCartographyMapItem26_3(item: ItemStack | null): boolean {
  if (!item?.map) return false;
  if (item.id === FILLED_MAP_ID) return true;
  const name = ItemRegistry.get(item.id)?.name;
  return !!name && isExplorerMapItemName26_3(name);
}

/** P3.5 + Java 26.3 Explorer Map action resolution. */
export function getCartographyAction(mapItem: ItemStack | null, ingredient: ItemStack | null): CartographyAction {
  if (!mapItem || !ingredient || !isCartographyMapItem26_3(mapItem)) return null;

  const itemName = ItemRegistry.get(mapItem.id)?.name;
  const explorerMap = !!itemName && isExplorerMapItemName26_3(itemName);

  // Explorer Maps remain cloneable and copies keep their dedicated item type.
  if (ingredient.id === EMPTY_MAP_ID) return 'clone';
  if (mapItem.map!.locked) return null;

  // Java 26.3: Explorer Maps (including Buried Treasure Map) are not in
  // #minecraft:extendable_maps, so paper cannot zoom them out.
  if (ingredient.id === PAPER_ID) {
    return !explorerMap && mapItem.map!.scale < MAX_MAP_SCALE ? 'zoom' : null;
  }
  if (ingredient.id === GLASS_PANE_ID) return 'lock';
  return null;
}

/** P3.5 — Cartography table: clone / zoom out / lock a filled map. */
export const CartographyUI: React.FC<CartographyUIProps> = ({ inventory, onClose, onInventoryChange, getItemIconStyle, onCraft }) => {
  const { getLocalizedDisplayName } = useI18n();
  const [mapItem, setMapItem] = useState<ItemStack | null>(null);
  const [ingredient, setIngredient] = useState<ItemStack | null>(null);

  const action = useMemo(() => getCartographyAction(mapItem, ingredient), [mapItem, ingredient]);
  const result = useMemo(
    () => (mapItem && ingredient ? onCraft(mapItem, ingredient) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapItem, ingredient],
  );

  const actionLabel = action === 'clone' ? 'Clone Map' : action === 'zoom' ? 'Zoom Out' : action === 'lock' ? 'Lock Map' : '';

  const takeFromInventory = (predicate: (item: ItemStack) => boolean): ItemStack | null => {
    for (let slot = 0; slot < 36; slot++) {
      const item = inventory.getSlot(slot);
      if (item && predicate(item)) {
        inventory.setSlot(slot, null);
        onInventoryChange();
        return { ...item, count: 1 };
      }
    }
    return null;
  };

  const handleMapSlot = () => {
    if (mapItem) {
      inventory.addStack({ ...mapItem, count: 1 });
      setMapItem(null);
      onInventoryChange();
      return;
    }
    const found = takeFromInventory((item) => isCartographyMapItem26_3(item));
    if (found) setMapItem(found);
  };

  const handleIngredientSlot = () => {
    if (ingredient) {
      inventory.addStack({ ...ingredient, count: 1 });
      setIngredient(null);
      onInventoryChange();
      return;
    }
    const found = takeFromInventory((item) => item.id === EMPTY_MAP_ID || item.id === PAPER_ID || item.id === GLASS_PANE_ID);
    if (found) setIngredient(found);
  };

  const handleCraft = () => {
    if (!result || !action || !mapItem || !ingredient) return;
    // Game's legacy cartography callback emits the old filled_map id. Dedicated
    // 26.3 Explorer Maps must preserve their own item id when cloned/locked.
    const output = mapItem.id === FILLED_MAP_ID ? result : { ...result, id: mapItem.id };
    if (action === 'clone') {
      inventory.addStack({ ...output, count: 1 });
      setIngredient(null);
    } else if (action === 'zoom') {
      inventory.addStack({ ...output, count: 1 });
      setMapItem(null);
      setIngredient(null);
    } else {
      inventory.addStack({ ...output, count: 1 });
      setMapItem(null);
      setIngredient(null);
    }
    onInventoryChange();
  };

  const renderSlot = (item: ItemStack | null, onClick: () => void, label: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div
        onClick={onClick}
        style={{
          width: SLOT_SIZE, height: SLOT_SIZE, background: '#8b8b8b',
          border: '2px solid', borderColor: '#373737 #fff #fff #373737',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        {item && <div style={getItemIconStyle(item.id, 34)} />}
      </div>
      <div style={{ color: '#555', fontSize: '10px' }}>{label}</div>
    </div>
  );

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      fontFamily: '"Courier New", monospace',
    }}>
      <div style={{
        width: '520px', background: '#c6c6c6', border: '4px solid',
        borderColor: '#fff #555 #555 #fff', padding: '18px', color: '#222',
      }}>
        <div style={{ fontSize: '14px', marginBottom: '12px', fontWeight: 'bold' }}>
          {getLocalizedDisplayName('Cartography Table')}
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
          {renderSlot(mapItem, handleMapSlot, 'Map')}
          {renderSlot(ingredient, handleIngredientSlot, 'Ingredient')}
          <div style={{ fontSize: '20px', color: '#555' }}>→</div>
          <div onClick={handleCraft} style={{
            width: SLOT_SIZE, height: SLOT_SIZE, background: '#8b8b8b',
            border: '2px solid', borderColor: '#373737 #fff #fff #373737',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: result ? 'pointer' : 'default',
          }}>
            {result && <div style={getItemIconStyle(outputPreviewId(mapItem, result), 34)} />}
          </div>
          <div style={{ fontSize: '12px', color: action ? '#206020' : '#555', minWidth: '90px' }}>
            {actionLabel || '—'}
          </div>
        </div>

        <div style={{ fontSize: '12px', marginBottom: '8px', color: '#444' }}>Inventory</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 48px)', gap: '2px' }}>
          {Array.from({ length: 36 }, (_, i) => {
            const item = inventory.getSlot(i);
            return (
              <div
                key={i}
                onClick={() => {
                  if (!item) return;
                  if (isCartographyMapItem26_3(item) && !mapItem) {
                    inventory.setSlot(i, null);
                    setMapItem({ ...item, count: 1 });
                  } else if ((item.id === EMPTY_MAP_ID || item.id === PAPER_ID || item.id === GLASS_PANE_ID) && !ingredient) {
                    inventory.setSlot(i, null);
                    setIngredient({ ...item, count: 1 });
                  }
                  onInventoryChange();
                }}
                style={{
                  width: SLOT_SIZE, height: SLOT_SIZE, background: '#8b8b8b',
                  border: '2px solid', borderColor: '#373737 #fff #fff #373737',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                {item && <div style={getItemIconStyle(item.id, 34)} />}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{ marginTop: '12px', padding: '6px 14px', background: '#c22', color: '#fff', border: '2px solid #555', cursor: 'pointer', fontFamily: '"Courier New", monospace' }}
        >
          Close (E)
        </button>
      </div>
    </div>
  );
};

function outputPreviewId(mapItem: ItemStack | null, result: ItemStack): number {
  return mapItem && mapItem.id !== FILLED_MAP_ID ? mapItem.id : result.id;
}
