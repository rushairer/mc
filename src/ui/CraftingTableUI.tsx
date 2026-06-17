import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory } from '../player/Inventory';
import { findCraftingResult } from '../items/CraftingRecipes';
import { useI18n } from '../i18n';

interface CraftingTableUIProps {
  inventory: Inventory;
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
}

const SLOT_SIZE = 48;

export const CraftingTableUI: React.FC<CraftingTableUIProps> = ({ inventory, onClose, onInventoryChange, getItemIconStyle }) => {
  const { t, getLocalizedItemName, getLocalizedCategory } = useI18n();
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [craftingGrid, setCraftingGrid] = useState<number[]>(new Array(9).fill(0));
  const [craftResult, setCraftResult] = useState<{ id: number; count: number } | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{
    item: ItemStack;
    itemDef: any;
    x: number;
    y: number;
  } | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Track mouse for held item
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      const held = document.getElementById('held-item-table');
      if (held) {
        held.style.left = `${e.clientX - SLOT_SIZE / 2}px`;
        held.style.top = `${e.clientY - SLOT_SIZE / 2}px`;
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  // Recalculate crafting result when grid changes
  useEffect(() => {
    const result = findCraftingResult(craftingGrid);
    setCraftResult(result);
  }, [craftingGrid]);

  const handleSlotClick = useCallback((slotIndex: number, isCraftingSlot?: boolean) => {
    if (isCraftingSlot) {
      // Crafting grid click
      const newGrid = [...craftingGrid];
      if (heldItem && newGrid[slotIndex] === 0) {
        newGrid[slotIndex] = heldItem.id;
        setHeldItem(prev => {
          if (!prev) return null;
          const newCount = prev.count - 1;
          return newCount > 0 ? { ...prev, count: newCount } : null;
        });
      } else if (!heldItem && newGrid[slotIndex] !== 0) {
        const itemId = newGrid[slotIndex];
        newGrid[slotIndex] = 0;
        setHeldItem({ id: itemId, count: 1 });
      }
      setCraftingGrid(newGrid);
      return;
    }

    // Inventory slot click
    const slotItem = inventory.getSlot(slotIndex);

    if (heldItem && slotItem && heldItem.id === slotItem.id) {
      // Stack items
      const maxStack = ItemRegistry.getMaxStackSize(heldItem.id);
      const canAdd = Math.min(heldItem.count, maxStack - slotItem.count);
      slotItem.count += canAdd;
      const leftover = heldItem.count - canAdd;
      setHeldItem(leftover > 0 ? { ...heldItem, count: leftover } : null);
    } else if (heldItem && !slotItem) {
      // Place held item
      inventory.setSlot(slotIndex, heldItem);
      setHeldItem(null);
    } else if (!heldItem && slotItem) {
      // Pick up slot
      setHeldItem(slotItem);
      inventory.setSlot(slotIndex, null);
    } else if (heldItem && slotItem) {
      // Swap
      inventory.setSlot(slotIndex, heldItem);
      setHeldItem(slotItem);
    }

    onInventoryChange();
  }, [heldItem, inventory, craftingGrid, onInventoryChange]);

  const handleCraftResultClick = useCallback(() => {
    if (!craftResult) return;
    // Add result to inventory
    inventory.addItem(craftResult.id, craftResult.count);
    // Remove one of each ingredient from crafting grid
    const newGrid = craftingGrid.map(() => 0); // clear all on craft
    setCraftingGrid(newGrid);
    onInventoryChange();
  }, [craftResult, inventory, craftingGrid, onInventoryChange]);

  const handleClose = useCallback(() => {
    // Return held item to inventory
    if (heldItem) {
      inventory.addItem(heldItem.id, heldItem.count);
      setHeldItem(null);
    }
    // Return crafting grid items to inventory
    for (const id of craftingGrid) {
      if (id !== 0) inventory.addItem(id, 1);
    }
    setCraftingGrid(new Array(9).fill(0));
    onInventoryChange();
    onClose();
  }, [heldItem, inventory, craftingGrid, onInventoryChange, onClose]);

  // Close on E or Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' || e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const renderSlot = (item: ItemStack | null, index: number, onClick: () => void, highlight?: boolean) => {
    const itemDef = item ? ItemRegistry.get(item.id) : null;
    return (
      <div
        key={index}
        onClick={() => {
          setHoveredSlot(null);
          onClick();
        }}
        onMouseEnter={(e) => {
          if (item && itemDef && !heldItem) {
            setHoveredSlot({
              item,
              itemDef,
              x: e.clientX,
              y: e.clientY,
            });
          }
        }}
        onMouseMove={(e) => {
          if (item && itemDef && !heldItem) {
            setHoveredSlot({
              item,
              itemDef,
              x: e.clientX,
              y: e.clientY,
            });
          }
        }}
        onMouseLeave={() => {
          setHoveredSlot(null);
        }}
        style={{
          width: SLOT_SIZE,
          height: SLOT_SIZE,
          border: highlight ? '2px solid #fff' : '2px solid #555',
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
              <span style={{
                position: 'absolute',
                bottom: '1px',
                right: '3px',
                fontSize: '11px',
                fontWeight: 'bold',
              }}>
                {item.count}
              </span>
            )}
            {item && item.durability !== undefined && (
              (() => {
                const maxDur = ItemRegistry.get(item.id)?.durability ?? 100;
                if (item.durability >= maxDur) return null;
                const pct = Math.max(0, Math.min(1, item.durability / maxDur));
                const hue = pct * 120;
                const color = `hsl(${hue}, 100%, 45%)`;
                return (
                  <div style={{
                    position: 'absolute',
                    bottom: '2px',
                    left: '2px',
                    right: '2px',
                    height: '3px',
                    background: '#000',
                    borderRadius: '1px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct * 100}%`,
                      height: '100%',
                      background: color,
                    }} />
                  </div>
                );
              })()
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{
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
    }}>
      <div style={{
        background: 'rgba(40,40,40,0.95)',
        border: '3px solid #666',
        borderRadius: '8px',
        padding: '20px',
        color: '#fff',
        position: 'relative',
      }}>
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
        {/* Crafting area */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>{t('craftingTable3x3')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(3, ${SLOT_SIZE}px)`,
              gap: '2px',
            }}>
              {craftingGrid.map((id, i) => {
                const item = id !== 0 ? { id, count: 1 } : null;
                return renderSlot(item, i, () => handleSlotClick(i, true));
              })}
            </div>
            <div style={{ fontSize: '20px', color: '#aaa' }}>→</div>
            {renderSlot(craftResult, -1, handleCraftResultClick, true)}
          </div>
        </div>

        <div style={{ height: '1px', background: '#555', margin: '12px 0' }} />

        {/* Main inventory (27 slots) */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>{t('inventory')}</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(9, ${SLOT_SIZE}px)`,
            gap: '2px',
          }}>
            {Array.from({ length: 27 }, (_, i) => {
              const slotIdx = i + 9;
              return renderSlot(
                inventory.getSlot(slotIdx),
                slotIdx,
                () => handleSlotClick(slotIdx)
              );
            })}
          </div>
        </div>

        {/* Hotbar */}
        <div>
          <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>{t('hotbar')}</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(9, ${SLOT_SIZE}px)`,
            gap: '2px',
          }}>
            {Array.from({ length: 9 }, (_, i) =>
              renderSlot(inventory.getSlot(i), i, () => handleSlotClick(i))
            )}
          </div>
        </div>
      </div>

      {/* Held item following cursor */}
      {heldItem && (
        <div
          id="held-item-table"
          style={{
            position: 'fixed',
            width: SLOT_SIZE,
            height: SLOT_SIZE,
            pointerEvents: 'none',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            color: '#fff',
            textShadow: '1px 1px 0 #000',
          }}
        >
          <div style={getItemIconStyle(heldItem.id, 32)} />
          {heldItem.count > 1 && (
            <span style={{ position: 'absolute', bottom: '1px', right: '3px', fontSize: '11px', fontWeight: 'bold' }}>
              {heldItem.count}
            </span>
          )}
        </div>
      )}

      {/* Minecraft-style Premium Hover Tooltip */}
      {hoveredSlot && !heldItem && (
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
