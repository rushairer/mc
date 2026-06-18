import React, { useState, useCallback, useEffect } from 'react';
import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory } from '../player/Inventory';
import { findSmeltingResult } from '../items/SmeltingRecipes';
import { useI18n } from '../i18n';

interface FurnaceUIProps {
  inventory: Inventory;
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
  onDropItem?: (itemId: number, count: number) => void;
}

const SLOT_SIZE = 48;

export const FurnaceUI: React.FC<FurnaceUIProps> = ({ inventory, onClose, onInventoryChange, getItemIconStyle, onDropItem }) => {
  const { t, getLocalizedItemName, getLocalizedCategory } = useI18n();
  const [inputSlot, setInputSlot] = useState<ItemStack | null>(null);
  const [fuelSlot, setFuelSlot] = useState<ItemStack | null>(null);
  const [outputSlot, setOutputSlot] = useState<ItemStack | null>(null);
  const [isSmelting, setIsSmelting] = useState(false);
  const [smeltProgress, setSmeltProgress] = useState(0);
  const [fuelProgress, setFuelProgress] = useState(0);
  const [hoveredSlot, setHoveredSlot] = useState<{
    item: ItemStack;
    itemDef: any;
    x: number;
    y: number;
    index: number;
    type: 'inventory' | 'input' | 'fuel' | 'output';
  } | null>(null);

  // Check if smelting should start
  useEffect(() => {
    if (!inputSlot || !fuelSlot) {
      setIsSmelting(false);
      return;
    }

    const recipe = findSmeltingResult(inputSlot.id);
    if (!recipe) {
      setIsSmelting(false);
      return;
    }

    // Check fuel
    const baseFuelId = fuelSlot.id & 0x3FF;
    const isFuel = baseFuelId === 263 || baseFuelId === 5 || baseFuelId === 17;
    if (!isFuel) {
      setIsSmelting(false);
      return;
    }

    setIsSmelting(true);
  }, [inputSlot, fuelSlot]);

  // Smelting progress
  useEffect(() => {
    if (!isSmelting) return;

    const interval = setInterval(() => {
      setSmeltProgress(prev => {
        const next = prev + 0.05; // 20 ticks per second
        if (next >= 1) {
          // Smelt complete
          if (inputSlot) {
            const recipe = findSmeltingResult(inputSlot.id);
            if (recipe) {
              setInputSlot(prev => {
                if (!prev) return null;
                const newCount = prev.count - 1;
                return newCount > 0 ? { ...prev, count: newCount } : null;
              });
              setOutputSlot(prev => {
                if (prev && prev.id === recipe.output) {
                  return { ...prev, count: prev.count + recipe.outputCount };
                }
                return { id: recipe.output, count: recipe.outputCount };
              });
              // Consume fuel
              setFuelSlot(prev => {
                if (!prev) return null;
                const newCount = prev.count - 1;
                return newCount > 0 ? { ...prev, count: newCount } : null;
              });
            }
          }
          return 0;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isSmelting, inputSlot, fuelSlot]);

  const handleClose = useCallback(() => {
    if (inputSlot) inventory.addItem(inputSlot.id, inputSlot.count);
    if (fuelSlot) inventory.addItem(fuelSlot.id, fuelSlot.count);
    if (outputSlot) inventory.addItem(outputSlot.id, outputSlot.count);
    onInventoryChange();
    onClose();
  }, [inputSlot, fuelSlot, outputSlot, inventory, onInventoryChange, onClose]);

  // Close on E or Escape key, drop on Q
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' || e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key.toLowerCase() === 'q') {
        if (hoveredSlot) {
          const { index, type } = hoveredSlot;
          if (type === 'inventory') {
            const slotItem = inventory.getSlot(index);
            if (slotItem) {
              const dropCount = (e.ctrlKey || e.metaKey || e.shiftKey) ? slotItem.count : 1;
              onDropItem?.(slotItem.id, dropCount);
              if (slotItem.count <= dropCount) {
                inventory.setSlot(index, null);
                setHoveredSlot(null);
              } else {
                slotItem.count -= dropCount;
                setHoveredSlot({ ...hoveredSlot, item: { ...slotItem } });
              }
              onInventoryChange();
            }
          }
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose, hoveredSlot, inventory, onDropItem, onInventoryChange]);

  const renderSlot = (item: ItemStack | null, onClick: () => void, slotType: 'input' | 'fuel' | 'output' = 'input') => {
    const itemDef = item ? ItemRegistry.get(item.id) : null;
    return (
      <div
        onClick={() => {
          setHoveredSlot(null);
          onClick();
        }}
        onMouseEnter={(e) => {
          if (item && itemDef) {
            setHoveredSlot({
              item,
              itemDef,
              x: e.clientX,
              y: e.clientY,
              index: -1,
              type: slotType,
            });
          }
        }}
        onMouseMove={(e) => {
          if (item && itemDef) {
            setHoveredSlot({
              item,
              itemDef,
              x: e.clientX,
              y: e.clientY,
              index: -1,
              type: slotType,
            });
          }
        }}
        onMouseLeave={() => {
          setHoveredSlot(null);
        }}
        style={{
          width: SLOT_SIZE,
          height: SLOT_SIZE,
          border: '2px solid #555',
          background: 'rgba(50,50,50,0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          fontSize: '9px',
          color: '#fff',
          textShadow: '1px 1px 0 #000',
          userSelect: 'none',
        }}
      >
        {item && itemDef && (
          <>
            <div style={getItemIconStyle(item.id, 32)} />
            {item.count > 1 && (
              <span style={{ position: 'absolute', bottom: '1px', right: '3px', fontSize: '11px', fontWeight: 'bold' }}>
                {item.count}
              </span>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        fontFamily: '"Courier New", monospace',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(40,40,40,0.95)',
          border: '3px solid #666',
          borderRadius: '8px',
          padding: '20px',
          color: '#fff',
          position: 'relative',
        }}
      >
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: '#c22',
            color: '#fff',
            border: '2px solid #555',
            borderRadius: '4px',
            width: '24px',
            height: '24px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '1px 1px 0 #000',
            fontFamily: 'monospace',
          }}
          title={t('closeEsc')}
        >
          X
        </button>
        <div style={{ fontSize: '14px', marginBottom: '12px', color: '#aaa' }}>{t('furnace')}</div>

        {/* Input → Output */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>{t('input')}</div>
            {renderSlot(inputSlot, () => {
              if (!inputSlot) return;
              inventory.addItem(inputSlot.id, inputSlot.count);
              setInputSlot(null);
              onInventoryChange();
            }, 'input')}
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>{t('fuel')}</div>
            {renderSlot(fuelSlot, () => {
              if (!fuelSlot) return;
              inventory.addItem(fuelSlot.id, fuelSlot.count);
              setFuelSlot(null);
              onInventoryChange();
            }, 'fuel')}
          </div>
          <div style={{ fontSize: '20px', color: '#aaa' }}>→</div>
          <div>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>{t('output')}</div>
            {renderSlot(outputSlot, () => {
              if (!outputSlot) return;
              inventory.addItem(outputSlot.id, outputSlot.count);
              setOutputSlot(null);
              onInventoryChange();
            }, 'output')}
          </div>
        </div>


        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '8px',
          background: '#333',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '16px',
        }}>
          <div style={{
            width: `${smeltProgress * 100}%`,
            height: '100%',
            background: '#f80',
            transition: 'width 0.05s linear',
          }} />
        </div>

        {/* Inventory to pick items from */}
        <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>{t('inventory')}</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(9, ${SLOT_SIZE}px)`,
          gap: '2px',
        }}>
          {Array.from({ length: 36 }, (_, i) => {
            const item = inventory.getSlot(i);
            const itemDef = item ? ItemRegistry.get(item.id) : null;
            return (
              <div
                key={i}
                onClick={() => {
                  if (!item) return;
                  const recipe = findSmeltingResult(item.id);
                  const baseItemId = item.id & 0x3FF;
                  const isFuel = baseItemId === 263 || baseItemId === 5 || baseItemId === 17;

                  setHoveredSlot(null);

                  if (recipe && !inputSlot) {
                    setInputSlot({ id: item.id, count: 1 });
                    inventory.removeFromSlot(i);
                    onInventoryChange();
                  } else if (isFuel && !fuelSlot) {
                    setFuelSlot({ id: item.id, count: 1 });
                    inventory.removeFromSlot(i);
                    onInventoryChange();
                  }
                }}
                onMouseEnter={(e) => {
                  if (item && itemDef) {
                    setHoveredSlot({
                      item,
                      itemDef,
                      x: e.clientX,
                      y: e.clientY,
                      index: i,
                      type: 'inventory',
                    });
                  }
                }}
                onMouseMove={(e) => {
                  if (item && itemDef) {
                    setHoveredSlot({
                      item,
                      itemDef,
                      x: e.clientX,
                      y: e.clientY,
                      index: i,
                      type: 'inventory',
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredSlot(null);
                }}
                style={{
                  width: SLOT_SIZE,
                  height: SLOT_SIZE,
                  border: '2px solid #444',
                  background: 'rgba(50,50,50,0.9)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '9px',
                  color: '#fff',
                  textShadow: '1px 1px 0 #000',
                  userSelect: 'none',
                }}
              >
                {item && itemDef && (
                  <>
                    <div style={getItemIconStyle(item.id, 32)} />
                    {item.count > 1 && (
                      <span style={{ position: 'absolute', bottom: '1px', right: '3px', fontSize: '11px', fontWeight: 'bold' }}>
                        {item.count}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Minecraft-style Premium Hover Tooltip */}
      {hoveredSlot && (
        <div style={{
          position: 'fixed',
          left: `${hoveredSlot.x + 12}px`,
          top: `${hoveredSlot.y - 12}px`,
          background: 'rgba(16, 0, 16, 0.95)',
          border: '2px solid #2b0054',
          boxShadow: '0 0 0 1px #5e00a8',
          padding: '6px 10px',
          borderRadius: '4px',
          color: '#fff',
          fontFamily: '"Courier New", monospace',
          fontSize: '12px',
          zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minWidth: '120px',
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#ffffff', textShadow: '1px 1px 0 #000' }}>
            {getLocalizedItemName(hoveredSlot.item.id, hoveredSlot.itemDef.displayName)}
          </span>
          <span style={{ color: '#888888', fontSize: '10px', textTransform: 'capitalize' }}>
            {getLocalizedCategory(hoveredSlot.itemDef.category)}
          </span>
          {hoveredSlot.item.durability !== undefined && hoveredSlot.itemDef.durability && (
            <span style={{ color: '#55FF55', fontSize: '10px' }}>
              {t('durability', { current: hoveredSlot.item.durability, max: hoveredSlot.itemDef.durability })}
            </span>
          )}
        </div>
      )}

    </div>
  );
};
