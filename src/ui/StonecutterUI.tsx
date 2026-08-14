import React, { useMemo, useState } from 'react';
import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory } from '../player/Inventory';
import { getStonecuttingResults, isStonecuttingInput } from '../items/StonecuttingRecipes';
import { BlockRegistry } from '../world/BlockRegistry';
import { useI18n } from '../i18n';

interface StonecutterUIProps {
  inventory: Inventory;
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
}

const SLOT_SIZE = 48;

/** P3.5 — Stonecutter: one stone-type input, pick a cut product. */
export const StonecutterUI: React.FC<StonecutterUIProps> = ({ inventory, onClose, onInventoryChange, getItemIconStyle }) => {
  const { getLocalizedItemName, getLocalizedDisplayName } = useI18n();
  const [input, setInput] = useState<ItemStack | null>(null);

  const results = useMemo(
    () => (input ? getStonecuttingResults(input.id) : []),
    [input],
  );

  const handleInputClick = () => {
    // Cycle through the first matching stone-type block in the inventory.
    for (let slot = 0; slot < 36; slot++) {
      const item = inventory.getSlot(slot);
      if (item && isStonecuttingInput(item.id)) {
        inventory.setSlot(slot, null);
        setInput({ id: item.id, count: 1 });
        onInventoryChange();
        return;
      }
    }
  };

  const handleOutputClick = (outputBlockId: number, count: number) => {
    if (!input) return;
    inventory.addItem(outputBlockId, count);
    const remaining = input.count - 1;
    if (remaining <= 0) {
      setInput(null);
    } else {
      setInput({ ...input, count: remaining });
    }
    onInventoryChange();
  };

  const renderSlot = (item: ItemStack | null, onClick: () => void, label?: string) => {
    const itemDef = item ? ItemRegistry.get(item.id) : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <div
          onClick={onClick}
          style={{
            width: SLOT_SIZE, height: SLOT_SIZE, background: '#8b8b8b',
            border: '2px solid', borderColor: '#373737 #fff #fff #373737',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative',
          }}
        >
          {item && itemDef && <div style={getItemIconStyle(item.id, 34)} />}
        </div>
        {label && <div style={{ color: '#555', fontSize: '10px' }}>{label}</div>}
      </div>
    );
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      fontFamily: '"Courier New", monospace',
    }}>
      <div style={{
        width: '640px', background: '#c6c6c6', border: '4px solid',
        borderColor: '#fff #555 #555 #fff', padding: '18px', color: '#222',
      }}>
        <div style={{ fontSize: '14px', marginBottom: '12px', fontWeight: 'bold' }}>
          {getLocalizedDisplayName('Stonecutter')}
        </div>
        <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start', marginBottom: '16px' }}>
          {renderSlot(input, handleInputClick, 'Input (stone)')}
          <div style={{ fontSize: '20px', color: '#555', alignSelf: 'center' }}>→</div>
          <div style={{
            flex: 1, border: '2px solid #999', background: '#d8d8d8', padding: '8px',
            minHeight: '110px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignContent: 'flex-start',
          }}>
            {results.map((result) => {
              const def = BlockRegistry.get(result.outputBlockId);
              if (!def) return null;
              return (
                <div
                  key={result.outputBlockId}
                  title={`${getLocalizedItemName(result.outputBlockId, def.displayName ?? def.name)} x${result.count}`}
                  onClick={() => handleOutputClick(result.outputBlockId, result.count)}
                  style={{
                    width: 46, height: 46, background: 'rgba(60,60,60,0.9)', border: '2px solid #666',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', position: 'relative',
                  }}
                >
                  <div style={getItemIconStyle(result.outputBlockId, 30)} />
                  {result.count > 1 && (
                    <span style={{ position: 'absolute', bottom: 1, right: 3, fontSize: '10px', fontWeight: 'bold', color: '#fff' }}>
                      {result.count}
                    </span>
                  )}
                </div>
              );
            })}
            {results.length === 0 && (
              <div style={{ color: '#777', fontSize: '12px', padding: '12px' }}>
                Place a stone-type block in the input.
              </div>
            )}
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
                  inventory.setSlot(i, null);
                  setInput({ id: item.id, count: 1 });
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
