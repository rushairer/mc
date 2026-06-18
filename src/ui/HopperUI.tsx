import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ItemStack } from '../types';
import { Inventory } from '../player/Inventory';
import { ItemRegistry } from '../items/ItemRegistry';
import { EnchantSystem } from '../systems/EnchantSystem';
import { PotionEffects } from '../systems/PotionEffect';
import { useI18n } from '../i18n';

interface HopperUIProps {
  inventory: Inventory;
  hopperSlots: (ItemStack | null)[];
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
  onDropItem?: (itemId: number, count: number) => void;
}

const SLOT_SIZE = 48;
const HOPPER_SIZE = 5;

type SlotTarget =
  | { type: 'hopper'; index: number }
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

export const HopperUI: React.FC<HopperUIProps> = ({
  inventory,
  hopperSlots,
  onClose,
  onInventoryChange,
  getItemIconStyle,
  onDropItem,
}) => {
  const { t, getLocalizedItemName, getLocalizedCategory } = useI18n();
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [, forceRender] = useState(0);
  const [hoveredSlot, setHoveredSlot] = useState<{
    item: ItemStack;
    itemDef: any;
    x: number;
    y: number;
    target: SlotTarget;
  } | null>(null);

  const moveHeldRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      moveHeldRef.current = { x: e.clientX, y: e.clientY };
      const held = document.getElementById('hopper-held-item');
      if (held) {
        held.style.left = `${e.clientX - SLOT_SIZE / 2}px`;
        held.style.top = `${e.clientY - SLOT_SIZE / 2}px`;
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  const getSlot = useCallback((target: SlotTarget): ItemStack | null => {
    return target.type === 'hopper'
      ? hopperSlots[target.index] ?? null
      : inventory.getSlot(target.index);
  }, [hopperSlots, inventory]);

  const setSlot = useCallback((target: SlotTarget, item: ItemStack | null) => {
    if (target.type === 'hopper') {
      hopperSlots[target.index] = item;
    } else {
      inventory.setSlot(target.index, item);
    }
  }, [hopperSlots, inventory]);

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
        const hopperLeftover = addToSlots(hopperSlots, { ...heldItem, count: leftover });
        leftover = hopperLeftover?.count ?? 0;
      }
      setHeldItem(null);
    }
    notifyChanged();
    onClose();
  }, [hopperSlots, heldItem, inventory, notifyChanged, onClose]);

  // Close on E or Escape key, drop on Q
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' || e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key.toLowerCase() === 'q') {
        if (heldItem) {
          const dropCount = (e.ctrlKey || e.metaKey || e.shiftKey) ? heldItem.count : 1;
          onDropItem?.(heldItem.id, dropCount);
          setHeldItem(prev => {
            if (!prev) return null;
            const nextCount = prev.count - dropCount;
            return nextCount > 0 ? { ...prev, count: nextCount } : null;
          });
          notifyChanged();
        } else if (hoveredSlot) {
          const { target } = hoveredSlot;
          const slotItem = getSlot(target);
          if (slotItem) {
            const dropCount = (e.ctrlKey || e.metaKey || e.shiftKey) ? slotItem.count : 1;
            onDropItem?.(slotItem.id, dropCount);
            if (slotItem.count <= dropCount) {
              setSlot(target, null);
              setHoveredSlot(null);
            } else {
              slotItem.count -= dropCount;
              setHoveredSlot({ ...hoveredSlot, item: { ...slotItem } });
            }
            notifyChanged();
          }
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose, heldItem, hoveredSlot, getSlot, setSlot, notifyChanged, onDropItem]);

  const renderSlot = (item: ItemStack | null, target: SlotTarget, onClick: () => void) => {
    const itemDef = item ? ItemRegistry.get(item.id) : null;
    const slotKey = `${target.type}-${target.index}`;
    return (
      <div
        key={slotKey}
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
              target,
            });
          }
        }}
        onMouseLeave={() => {
          setHoveredSlot(null);
        }}
        style={{
          width: `${SLOT_SIZE}px`,
          height: `${SLOT_SIZE}px`,
          background: '#8b8b8b',
          borderTop: '3px solid #373737',
          borderLeft: '3px solid #373737',
          borderBottom: '3px solid #ffffff',
          borderRight: '3px solid #ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        {item && itemDef && (
          <div style={getItemIconStyle(item.id, 32)}>
            {item.count > 1 && (
              <span style={{
                position: 'absolute',
                bottom: '2px',
                right: '4px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 'bold',
                textShadow: '2px 2px 0px #000',
              }}>
                {item.count}
              </span>
            )}
          </div>
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
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#c6c6c6',
        borderTop: '4px solid #ffffff',
        borderLeft: '4px solid #ffffff',
        borderBottom: '4px solid #555555',
        borderRight: '4px solid #555555',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        color: '#404040',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        position: 'relative',
      }}>
        {/* Title */}
        <div style={{ fontSize: '16px', marginBottom: '4px' }}>
          {t('hopper') || 'Hopper'}
        </div>

        {/* Hopper Grid: 5 slots arranged horizontally */}
        <div style={{
          display: 'flex',
          gap: '2px',
          background: '#555555',
          padding: '4px',
          borderBottom: '2px solid #fff',
          borderRight: '2px solid #fff',
          width: 'fit-content',
        }}>
          {Array.from({ length: HOPPER_SIZE }).map((_, i) =>
            renderSlot(hopperSlots[i] ?? null, { type: 'hopper', index: i }, () => handleSlotClick({ type: 'hopper', index: i }))
          )}
        </div>

        {/* Player Inventory (Backpack: 3 rows of 9) */}
        <div style={{ fontSize: '14px', marginTop: '4px' }}>{t('inventory')}</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(9, 1fr)',
          gap: '2px',
          background: '#555555',
          padding: '4px',
          borderBottom: '2px solid #fff',
          borderRight: '2px solid #fff',
        }}>
          {Array.from({ length: 27 }).map((_, i) => {
            const index = i + 9; // Skip hotbar slots 0..8
            return renderSlot(
              inventory.getSlot(index),
              { type: 'player', index },
              () => handleSlotClick({ type: 'player', index })
            );
          })}
        </div>

        {/* Player Hotbar (1 row of 9) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(9, 1fr)',
          gap: '2px',
          background: '#555555',
          padding: '4px',
          borderBottom: '2px solid #fff',
          borderRight: '2px solid #fff',
          marginTop: '8px',
        }}>
          {Array.from({ length: 9 }).map((_, i) =>
            renderSlot(
              inventory.getSlot(i),
              { type: 'player', index: i },
              () => handleSlotClick({ type: 'player', index: i })
            )
          )}
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            marginTop: '12px',
            alignSelf: 'center',
            padding: '6px 16px',
            background: '#8b8b8b',
            borderTop: '2px solid #fff',
            borderLeft: '2px solid #fff',
            borderBottom: '2px solid #373737',
            borderRight: '2px solid #373737',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 'bold',
            textShadow: '1px 1px 0 #000',
          }}
        >
          {t('done') || 'Close'}
        </button>
      </div>

      {/* Held Item Layer */}
      {heldItem && (
        <div
          id="hopper-held-item"
          style={{
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: 110,
            width: `${SLOT_SIZE}px`,
            height: `${SLOT_SIZE}px`,
            left: `${moveHeldRef.current.x - SLOT_SIZE / 2}px`,
            top: `${moveHeldRef.current.y - SLOT_SIZE / 2}px`,
          }}
        >
          <div style={getItemIconStyle(heldItem.id, 32)}>
            {heldItem.count > 1 && (
              <span style={{
                position: 'absolute',
                bottom: '2px',
                right: '4px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 'bold',
                textShadow: '2px 2px 0px #000',
              }}>
                {heldItem.count}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tooltip Overlay */}
      {hoveredSlot && (
        <div style={{
          position: 'fixed',
          left: `${hoveredSlot.x + 16}px`,
          top: `${hoveredSlot.y + 16}px`,
          background: 'rgba(16, 0, 16, 0.92)',
          border: '2px solid #280064',
          borderRadius: '4px',
          padding: '8px 12px',
          color: '#fff',
          zIndex: 120,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: '0 0 8px rgba(0,0,0,0.8)',
        }}>
          <div style={{ color: '#fff', fontSize: '15px' }}>
            {getLocalizedItemName(hoveredSlot.item.id)}
          </div>
          <div style={{ color: '#aaa', fontSize: '12px' }}>
            {getLocalizedCategory(hoveredSlot.itemDef.category)}
          </div>
          {hoveredSlot.item.customName && (
            <div style={{ color: '#55ff55', fontSize: '12px', fontStyle: 'italic' }}>
              "{hoveredSlot.item.customName}"
            </div>
          )}
          {hoveredSlot.item.enchantments?.map((enchantment) => (
            <div key={enchantment.id} style={{ color: '#aaaaff', fontSize: '12px' }}>
              {EnchantSystem.getDisplayName(enchantment)}
            </div>
          ))}
          {hoveredSlot.item.potion?.effect && (
            <div style={{ color: '#aaaaff', fontSize: '12px' }}>
              {PotionEffects.format(hoveredSlot.item.potion.effect)}
              {hoveredSlot.item.potion.effect.duration > 0 ? ` ${Math.ceil(hoveredSlot.item.potion.effect.duration)}s` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
