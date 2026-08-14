import React, { useMemo, useState } from 'react';
import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory } from '../player/Inventory';
import { BANNER_PATTERNS } from '../items/BannerPatterns';
import { useI18n } from '../i18n';

interface LoomUIProps {
  inventory: Inventory;
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
}

const SLOT_SIZE = 48;
const BANNER_ID = 425;
const LEGACY_DYE_ID = 351;

const DYE_COLORS = ['black', 'red', 'green', 'brown', 'blue', 'purple', 'cyan', 'light_gray', 'gray', 'pink', 'lime', 'yellow', 'light_blue', 'magenta', 'orange', 'white'];

function dyeColorOf(item: ItemStack): string | null {
  const name = ItemRegistry.get(item.id)?.name ?? '';
  if ((item.id & 0x3FF) === LEGACY_DYE_ID) {
    return DYE_COLORS[(item.id >> 10) & 0xF] ?? null;
  }
  const match = name.match(/^([a-z_]+)_dye$/);
  return match ? match[1] : null;
}

/** P3.5 — Loom: apply a banner pattern (banner + dye). */
export const LoomUI: React.FC<LoomUIProps> = ({ inventory, onClose, onInventoryChange, getItemIconStyle }) => {
  const { getLocalizedItemName } = useI18n();
  const [banner, setBanner] = useState<ItemStack | null>(null);
  const [dye, setDye] = useState<ItemStack | null>(null);

  const dyeColor = useMemo(() => (dye ? dyeColorOf(dye) : null), [dye]);

  const findInInventory = (predicate: (item: ItemStack) => boolean): ItemStack | null => {
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

  const handleBannerSlot = () => {
    if (banner) {
      inventory.addStack({ ...banner, count: 1 });
      setBanner(null);
      onInventoryChange();
      return;
    }
    const found = findInInventory((item) => item.id === BANNER_ID);
    if (found) setBanner(found);
  };

  const handleDyeSlot = () => {
    if (dye) {
      inventory.addStack({ ...dye, count: 1 });
      setDye(null);
      onInventoryChange();
      return;
    }
    const found = findInInventory((item) => dyeColorOf(item) !== null);
    if (found) setDye(found);
  };

  const applyPattern = (patternId: string) => {
    if (!banner || !dye || !dyeColor) return;
    const patterns = [...(banner.patterns ?? []), { pattern: patternId, color: dyeColor }];
    const updated: ItemStack = { ...banner, count: 1, patterns };
    // Keep the banner in place; consume one dye.
    const dyeLeft = dye.count - 1;
    setDye(dyeLeft > 0 ? { ...dye, count: dyeLeft } : null);
    setBanner(updated);
    if (dyeLeft <= 0) {
      onInventoryChange();
    }
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
        width: '620px', background: '#c6c6c6', border: '4px solid',
        borderColor: '#fff #555 #555 #fff', padding: '18px', color: '#222',
      }}>
        <div style={{ fontSize: '14px', marginBottom: '12px', fontWeight: 'bold' }}>Loom</div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
          {renderSlot(banner, handleBannerSlot, 'Banner')}
          {renderSlot(dye, handleDyeSlot, 'Dye')}
          <div style={{ flex: 1, border: '2px solid #999', background: '#d8d8d8', padding: '8px', minHeight: '110px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignContent: 'flex-start' }}>
            {BANNER_PATTERNS.map((pattern) => (
              <div
                key={pattern.id}
                title={`${pattern.name} (${dyeColor ?? 'no dye'})`}
                onClick={() => applyPattern(pattern.id)}
                style={{
                  width: 46, height: 46, background: dyeColor ? '#3c3c3c' : '#777',
                  border: '2px solid #666', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: dyeColor ? 'pointer' : 'default',
                  fontSize: '18px',
                }}
              >
                <span style={{ color: dyeColor ?? '#999' }}>▮</span>
              </div>
            ))}
            {!dyeColor && (
              <div style={{ color: '#777', fontSize: '12px', padding: '12px', width: '100%' }}>
                Place a banner and a dye to select a pattern.
              </div>
            )}
          </div>
        </div>

        {banner && banner.patterns && banner.patterns.length > 0 && (
          <div style={{ fontSize: '11px', color: '#444', marginBottom: '8px' }}>
            Patterns: {banner.patterns.map((p) => `${p.pattern} (${p.color})`).join(', ')}
          </div>
        )}

        <div style={{ fontSize: '12px', marginBottom: '8px', color: '#444' }}>Inventory</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 48px)', gap: '2px' }}>
          {Array.from({ length: 36 }, (_, i) => {
            const item = inventory.getSlot(i);
            return (
              <div
                key={i}
                onClick={() => {
                  if (!item) return;
                  if (item.id === BANNER_ID && !banner) {
                    inventory.setSlot(i, null);
                    setBanner({ ...item, count: 1 });
                  } else if (!dye && dyeColorOf(item) !== null) {
                    inventory.setSlot(i, null);
                    setDye({ ...item, count: 1 });
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
