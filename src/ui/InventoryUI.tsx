import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory, HOTBAR_SIZE, INVENTORY_SIZE } from '../player/Inventory';
import { findCraftingResult } from '../items/CraftingRecipes';

interface InventoryUIProps {
  inventory: Inventory;
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
  gameMode?: 'survival' | 'creative';
}

const SLOT_SIZE = 48;

export const InventoryUI: React.FC<InventoryUIProps> = ({ inventory, onClose, onInventoryChange, getItemIconStyle, gameMode = 'survival' }) => {
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [craftingGrid, setCraftingGrid] = useState<number[]>(new Array(4).fill(0));
  const [craftResult, setCraftResult] = useState<{ id: number; count: number } | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{
    item: ItemStack;
    itemDef: any;
    x: number;
    y: number;
  } | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  const creativeItems = [
    // Blocks
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 39,
    // Tools
    120, 121, 122, 123, 130, 131, 132, 133, 140, 141, 142, 143, 150, 151, 152, 153, 160, 161, 162, 163,
    // Foods
    170, 171, 172, 173, 174, 175,
    // Armor
    180, 181, 182, 183, 184, 185, 186, 187,
    // Materials
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112
  ];

  const handleCatalogClick = (itemId: number) => {
    const maxStack = ItemRegistry.getMaxStackSize(itemId);
    setHeldItem({ id: itemId, count: maxStack });
  };

  // Track mouse for held item
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      const held = document.getElementById('held-item');
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
    // Convert 2x2 grid to 3x3 for findCraftingResult
    // 2x2 layout:
    // [0, 1]
    // [2, 3]
    // 3x3 layout:
    // [0, 1, 0]
    // [2, 3, 0]
    // [0, 0, 0]
    const grid3x3 = [
      craftingGrid[0], craftingGrid[1], 0,
      craftingGrid[2], craftingGrid[3], 0,
      0, 0, 0
    ];
    const result = findCraftingResult(grid3x3);
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
    const newGrid = craftingGrid.map(id => {
      if (id === 0) return 0;
      return 0; // clear all on craft
    });
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
    setCraftingGrid(new Array(4).fill(0));
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
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}>
        {/* Creative Item Catalog */}
        {gameMode === 'creative' && (
          <div style={{
            marginRight: '20px',
            width: '320px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ fontSize: '14px', marginBottom: '8px', color: '#ffaa00', fontWeight: 'bold' }}>Creative Catalog</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 48px)',
              gap: '2px',
              maxHeight: '330px',
              overflowY: 'auto',
              paddingRight: '4px',
              background: 'rgba(20,20,20,0.5)',
              border: '2px solid #444',
              borderRadius: '4px',
              padding: '4px',
            }}>
              {creativeItems.map((id) => {
                const itemDef = ItemRegistry.get(id);
                return (
                  <div
                    key={id}
                    onClick={() => handleCatalogClick(id)}
                    onMouseEnter={(e) => {
                      if (itemDef && !heldItem) {
                        setHoveredSlot({
                          item: { id, count: 1 },
                          itemDef,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }
                    }}
                    onMouseMove={(e) => {
                      if (itemDef && !heldItem) {
                        setHoveredSlot({
                          item: { id, count: 1 },
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
                      border: '2px solid #555',
                      background: 'rgba(60,60,60,0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={getItemIconStyle(id, 32)} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
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
          title="Close (Esc)"
        >
          X
        </button>
        {/* Crafting area */}
        {gameMode === 'survival' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>Crafting (2×2)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(2, ${SLOT_SIZE}px)`,
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
        )}

        {gameMode === 'survival' && <div style={{ height: '1px', background: '#555', margin: '12px 0' }} />}

        {/* Main inventory (27 slots) */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>Inventory</div>
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
          <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>Hotbar</div>
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
          id="held-item"
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
            {hoveredSlot.itemDef.displayName}
          </span>
          <span style={{ color: '#888888', fontSize: '10px', textTransform: 'capitalize' }}>
            {hoveredSlot.itemDef.category}
          </span>
          {hoveredSlot.item.durability !== undefined && hoveredSlot.itemDef.durability && (
            <span style={{ color: '#55FF55', fontSize: '10px' }}>
              Durability: {hoveredSlot.item.durability} / {hoveredSlot.itemDef.durability}
            </span>
          )}
        </div>
      )}
    </div>
    </div>
  );
};
