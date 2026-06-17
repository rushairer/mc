import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ItemStack } from '../types';
import { Inventory } from '../player/Inventory';
import { ItemRegistry } from '../items/ItemRegistry';

interface ChestUIProps {
  inventory: Inventory;
  chestSlots: (ItemStack | null)[];
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
}

const SLOT_SIZE = 48;
const CHEST_SIZE = 27;

type SlotTarget =
  | { type: 'chest'; index: number }
  | { type: 'player'; index: number };

function cloneStack(stack: ItemStack): ItemStack {
  return { ...stack };
}

function addToSlots(slots: (ItemStack | null)[], stack: ItemStack): ItemStack | null {
  const maxStack = ItemRegistry.getMaxStackSize(stack.id);
  let remaining = stack.count;

  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const slot = slots[i];
    if (slot && slot.id === stack.id && slot.count < maxStack) {
      const canAdd = Math.min(remaining, maxStack - slot.count);
      slot.count += canAdd;
      remaining -= canAdd;
    }
  }

  for (let i = 0; i < slots.length && remaining > 0; i++) {
    if (!slots[i]) {
      const toAdd = Math.min(remaining, maxStack);
      slots[i] = { ...stack, count: toAdd };
      remaining -= toAdd;
    }
  }

  return remaining > 0 ? { ...stack, count: remaining } : null;
}

export const ChestUI: React.FC<ChestUIProps> = ({
  inventory,
  chestSlots,
  onClose,
  onInventoryChange,
  getItemIconStyle,
}) => {
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [, forceRender] = useState(0);
  const [hoveredSlot, setHoveredSlot] = useState<{
    item: ItemStack;
    itemDef: any;
    x: number;
    y: number;
  } | null>(null);

  const moveHeldRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      moveHeldRef.current = { x: e.clientX, y: e.clientY };
      const held = document.getElementById('chest-held-item');
      if (held) {
        held.style.left = `${e.clientX - SLOT_SIZE / 2}px`;
        held.style.top = `${e.clientY - SLOT_SIZE / 2}px`;
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  const getSlot = useCallback((target: SlotTarget): ItemStack | null => {
    return target.type === 'chest'
      ? chestSlots[target.index] ?? null
      : inventory.getSlot(target.index);
  }, [chestSlots, inventory]);

  const setSlot = useCallback((target: SlotTarget, item: ItemStack | null) => {
    if (target.type === 'chest') {
      chestSlots[target.index] = item;
    } else {
      inventory.setSlot(target.index, item);
    }
  }, [chestSlots, inventory]);

  const notifyChanged = useCallback(() => {
    forceRender(v => v + 1);
    onInventoryChange();
  }, [onInventoryChange]);

  const handleSlotClick = useCallback((target: SlotTarget) => {
    const slotItem = getSlot(target);

    if (heldItem && slotItem && heldItem.id === slotItem.id) {
      const maxStack = ItemRegistry.getMaxStackSize(heldItem.id);
      const canAdd = Math.min(heldItem.count, maxStack - slotItem.count);
      if (canAdd > 0) {
        slotItem.count += canAdd;
        const leftover = heldItem.count - canAdd;
        setHeldItem(leftover > 0 ? { ...heldItem, count: leftover } : null);
      }
    } else if (heldItem && !slotItem) {
      setSlot(target, cloneStack(heldItem));
      setHeldItem(null);
    } else if (!heldItem && slotItem) {
      setHeldItem(cloneStack(slotItem));
      setSlot(target, null);
    } else if (heldItem && slotItem) {
      setSlot(target, cloneStack(heldItem));
      setHeldItem(cloneStack(slotItem));
    }

    notifyChanged();
  }, [getSlot, heldItem, notifyChanged, setSlot]);

  const handleClose = useCallback(() => {
    if (heldItem) {
      let leftover = inventory.addItem(heldItem.id, heldItem.count);
      if (leftover > 0) {
        const chestLeftover = addToSlots(chestSlots, { ...heldItem, count: leftover });
        leftover = chestLeftover?.count ?? 0;
      }
      setHeldItem(null);
    }
    notifyChanged();
    onClose();
  }, [chestSlots, heldItem, inventory, notifyChanged, onClose]);

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

  const renderSlot = (item: ItemStack | null, key: string, onClick: () => void) => {
    const itemDef = item ? ItemRegistry.get(item.id) : null;
    return (
      <div
        key={key}
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
          title="Close (Esc)"
        >
          X
        </button>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>Chest</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(9, ${SLOT_SIZE}px)`,
            gap: '2px',
          }}>
            {Array.from({ length: CHEST_SIZE }, (_, i) =>
              renderSlot(chestSlots[i] ?? null, `chest-${i}`, () => handleSlotClick({ type: 'chest', index: i }))
            )}
          </div>
        </div>

        <div style={{ height: '1px', background: '#555', margin: '12px 0' }} />

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>Inventory</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(9, ${SLOT_SIZE}px)`,
            gap: '2px',
          }}>
            {Array.from({ length: 27 }, (_, i) => {
              const slotIndex = i + 9;
              return renderSlot(
                inventory.getSlot(slotIndex),
                `inventory-${slotIndex}`,
                () => handleSlotClick({ type: 'player', index: slotIndex })
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>Hotbar</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(9, ${SLOT_SIZE}px)`,
            gap: '2px',
          }}>
            {Array.from({ length: 9 }, (_, i) =>
              renderSlot(
                inventory.getSlot(i),
                `hotbar-${i}`,
                () => handleSlotClick({ type: 'player', index: i })
              )
            )}
          </div>
        </div>
      </div>

      {heldItem && (
        <div
          id="chest-held-item"
          style={{
            position: 'fixed',
            width: SLOT_SIZE,
            height: SLOT_SIZE,
            pointerEvents: 'none',
            zIndex: 1000,
            left: moveHeldRef.current.x - SLOT_SIZE / 2,
            top: moveHeldRef.current.y - SLOT_SIZE / 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={getItemIconStyle(heldItem.id, 32)} />
          {heldItem.count > 1 && (
            <span style={{
              position: 'absolute',
              bottom: '2px',
              right: '4px',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 'bold',
              textShadow: '1px 1px 0 #000',
            }}>
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
  );
};
