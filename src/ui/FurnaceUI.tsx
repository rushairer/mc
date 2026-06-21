import React, { useState, useCallback, useEffect } from 'react';
import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory } from '../player/Inventory';
import { findSmeltingResult, isSmeltingFuel } from '../items/SmeltingRecipes';
import { useI18n } from '../i18n';

interface FurnaceUIProps {
  inventory: Inventory;
  furnaceSlots: (ItemStack | null)[];
  containerType?: 'furnace' | 'smoker' | 'blast_furnace';
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
  onDropItem?: (itemId: number, count: number) => void;
  burnTime?: number;
  cookTime?: number;
  maxBurnTime?: number;
}

const SLOT_SIZE = 48;

export const FurnaceUI: React.FC<FurnaceUIProps> = ({ 
  inventory, 
  furnaceSlots, 
  containerType = 'furnace', 
  onClose, 
  onInventoryChange, 
  getItemIconStyle, 
  onDropItem,
  burnTime = 0,
  cookTime = 0,
  maxBurnTime = 0
}) => {
  const { t, getLocalizedItemName, getLocalizedCategory } = useI18n();
  const [inputSlot, setInputSlot] = useState<ItemStack | null>(furnaceSlots[0]);
  const [fuelSlot, setFuelSlot] = useState<ItemStack | null>(furnaceSlots[1]);
  const [outputSlot, setOutputSlot] = useState<ItemStack | null>(furnaceSlots[2]);

  // Sync state changes back to furnaceSlots and notify parent
  useEffect(() => {
    furnaceSlots[0] = inputSlot;
    onInventoryChange();
  }, [inputSlot, furnaceSlots, onInventoryChange]);

  useEffect(() => {
    furnaceSlots[1] = fuelSlot;
    onInventoryChange();
  }, [fuelSlot, furnaceSlots, onInventoryChange]);

  useEffect(() => {
    furnaceSlots[2] = outputSlot;
    onInventoryChange();
  }, [outputSlot, furnaceSlots, onInventoryChange]);

  // Sync prop changes (from background smelting) into local React states
  useEffect(() => {
    setInputSlot(furnaceSlots[0]);
  }, [furnaceSlots[0]]);

  useEffect(() => {
    setFuelSlot(furnaceSlots[1]);
  }, [furnaceSlots[1]]);

  useEffect(() => {
    setOutputSlot(furnaceSlots[2]);
  }, [furnaceSlots[2]]);

  const [hoveredSlot, setHoveredSlot] = useState<{
    item: ItemStack;
    itemDef: any;
    x: number;
    y: number;
    index: number;
    type: 'inventory' | 'input' | 'fuel' | 'output';
  } | null>(null);

  // Calculate cook and fuel progress
  const inputItem = furnaceSlots[0];
  const recipe = inputItem ? findSmeltingResult(inputItem.id) : null;
  const totalCookTime = recipe ? recipe.cookTime : 10;
  
  const smeltProgress = totalCookTime > 0 ? Math.min(1, Math.max(0, cookTime / totalCookTime)) : 0;
  const fuelProgress = (maxBurnTime && maxBurnTime > 0) ? Math.min(1, Math.max(0, burnTime / maxBurnTime)) : 0;

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

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
        <div style={{ fontSize: '14px', marginBottom: '12px', color: '#aaa' }}>
          {containerType === 'smoker' ? t('smoker') : (containerType === 'blast_furnace' ? t('blastFurnace') : t('furnace'))}
        </div>

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
                  const isFuel = isSmeltingFuel(item.id);

                  setHoveredSlot(null);

                  if (recipe && !inputSlot) {
                    // Check if input is valid for the specific container type
                    const itemDef = ItemRegistry.get(item.id);
                    let isValid = true;
                    if (itemDef) {
                      if (containerType === 'smoker') {
                        isValid = ItemRegistry.isFood(item.id) || ItemRegistry.isFood(recipe.output);
                      } else if (containerType === 'blast_furnace') {
                        isValid = (itemDef.name.includes('ore') || itemDef.name.startsWith('raw_')) && !ItemRegistry.isFood(item.id);
                      }
                    } else {
                      isValid = false;
                    }

                    if (isValid) {
                      setInputSlot({ id: item.id, count: 1 });
                      inventory.removeFromSlot(i);
                      onInventoryChange();
                    }
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
