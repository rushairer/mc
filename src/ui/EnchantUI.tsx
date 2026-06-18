import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Enchantment } from '../systems/EnchantSystem';
import { EnchantSystem } from '../systems/EnchantSystem';
import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory, INVENTORY_SIZE } from '../player/Inventory';
import { useI18n } from '../i18n';

interface EnchantUIProps {
  inventory: Inventory;
  xpLevel: number;
  gameMode: 'survival' | 'creative';
  onClose: () => void;
  onInventoryChange: () => void;
  onEnchantItem: (item: ItemStack, cost: number, enchantment: Enchantment) => ItemStack | null;
  getItemIconStyle: (id: number, size?: number) => any;
}

const SLOT_SIZE = 48;

export const EnchantUI: React.FC<EnchantUIProps> = ({
  inventory,
  xpLevel,
  gameMode,
  onClose,
  onInventoryChange,
  onEnchantItem,
  getItemIconStyle,
}) => {
  const { getLocalizedItemName } = useI18n();
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [enchantSlot, setEnchantSlot] = useState<ItemStack | null>(null);
  const [hoveredItem, setHoveredItem] = useState<{ item: ItemStack; x: number; y: number } | null>(null);

  const options = useMemo(() => {
    return EnchantSystem.getOptions(enchantSlot, gameMode === 'creative' ? -1 : xpLevel);
  }, [enchantSlot, gameMode, xpLevel]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const held = document.getElementById('enchant-held-item');
      if (held) {
        held.style.left = `${e.clientX - SLOT_SIZE / 2}px`;
        held.style.top = `${e.clientY - SLOT_SIZE / 2}px`;
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  const returnLocalItems = useCallback(() => {
    if (heldItem) {
      inventory.addItem(heldItem.id, heldItem.count);
      setHeldItem(null);
    }
    if (enchantSlot) {
      inventory.addItem(enchantSlot.id, enchantSlot.count);
      setEnchantSlot(null);
    }
    onInventoryChange();
  }, [enchantSlot, heldItem, inventory, onInventoryChange]);

  const handleClose = useCallback(() => {
    returnLocalItems();
    onClose();
  }, [onClose, returnLocalItems]);

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

  const sameStackKind = (a: ItemStack, b: ItemStack) => {
    return a.id === b.id && JSON.stringify(a.enchantments ?? []) === JSON.stringify(b.enchantments ?? []);
  };

  const handleEnchantSlotClick = useCallback(() => {
    if (heldItem && !enchantSlot) {
      if (!EnchantSystem.canEnchantItem(heldItem)) return;
      setEnchantSlot(heldItem);
      setHeldItem(null);
    } else if (!heldItem && enchantSlot) {
      setHeldItem(enchantSlot);
      setEnchantSlot(null);
    } else if (heldItem && enchantSlot) {
      if (!EnchantSystem.canEnchantItem(heldItem)) return;
      setHeldItem(enchantSlot);
      setEnchantSlot(heldItem);
    }
    onInventoryChange();
  }, [enchantSlot, heldItem, onInventoryChange]);

  const handleInventorySlotClick = useCallback((slotIndex: number) => {
    const slotItem = inventory.getSlot(slotIndex);
    if (heldItem && slotItem && sameStackKind(heldItem, slotItem)) {
      const maxStack = ItemRegistry.getMaxStackSize(heldItem.id);
      const canAdd = Math.min(heldItem.count, maxStack - slotItem.count);
      slotItem.count += canAdd;
      const leftover = heldItem.count - canAdd;
      setHeldItem(leftover > 0 ? { ...heldItem, count: leftover } : null);
    } else if (heldItem && !slotItem) {
      inventory.setSlot(slotIndex, heldItem);
      setHeldItem(null);
    } else if (!heldItem && slotItem) {
      setHeldItem(slotItem);
      inventory.setSlot(slotIndex, null);
    } else if (heldItem && slotItem) {
      inventory.setSlot(slotIndex, heldItem);
      setHeldItem(slotItem);
    }
    onInventoryChange();
  }, [heldItem, inventory, onInventoryChange]);

  const handleOptionClick = (option: typeof options[number]) => {
    if (!enchantSlot) return;
    const result = onEnchantItem(enchantSlot, option.cost, option.enchantment);
    if (!result) return;
    setEnchantSlot(result);
    onInventoryChange();
  };

  const renderSlot = (item: ItemStack | null, onClick: () => void, special = false) => (
    <div
      onClick={onClick}
      onMouseEnter={(e) => item && setHoveredItem({ item, x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => item && setHoveredItem({ item, x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setHoveredItem(null)}
      style={{
        width: SLOT_SIZE,
        height: SLOT_SIZE,
        background: special ? '#241f35' : '#8b8b8b',
        border: '2px solid',
        borderColor: special ? '#7b60aa #120d20 #120d20 #7b60aa' : '#373737 #fff #fff #373737',
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {item && (
        <>
          <div style={getItemIconStyle(item.id, 34)} />
          {item.enchantments && item.enchantments.length > 0 && (
            <div style={{
              position: 'absolute',
              inset: 4,
              border: '1px solid rgba(170, 170, 255, 0.8)',
              boxShadow: '0 0 8px rgba(120, 80, 255, 0.9) inset',
              pointerEvents: 'none',
            }} />
          )}
          {item.count > 1 && (
            <span style={{
              position: 'absolute',
              bottom: 1,
              right: 3,
              color: '#fff',
              fontSize: '11px',
              fontWeight: 'bold',
              textShadow: '1px 1px 0 #000',
            }}>
              {item.count}
            </span>
          )}
        </>
      )}
    </div>
  );

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      fontFamily: '"Courier New", monospace',
      color: '#eee',
    }}>
      <div style={{
        width: '680px',
        background: '#c6c6c6',
        border: '4px solid',
        borderColor: '#fff #555 #555 #fff',
        padding: '18px',
        color: '#222',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', gap: '18px', marginBottom: '18px' }}>
          <div style={{
            width: '190px',
            minHeight: '150px',
            background: '#2a1f3c',
            border: '3px solid #111',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: '#d9ccff',
          }}>
            <div style={{ fontSize: '14px', color: '#bfa8ff' }}>Enchantment Table</div>
            {renderSlot(enchantSlot, handleEnchantSlotClick, true)}
            <div style={{ fontSize: '11px', color: '#aaa', textAlign: 'center', width: '150px' }}>
              Level {xpLevel}{gameMode === 'creative' ? ' - Creative' : ''}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {options.length > 0 ? options.map((option) => (
              <button
                key={option.enchantment.id}
                onClick={() => handleOptionClick(option)}
                style={{
                  minHeight: '44px',
                  background: '#3b235f',
                  color: '#d8c8ff',
                  border: '2px solid',
                  borderColor: '#8060b8 #1c102e #1c102e #8060b8',
                  fontFamily: '"Courier New", monospace',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  <span style={{ display: 'block', fontWeight: 'bold' }}>{option.label}</span>
                  <span style={{ display: 'block', fontSize: '11px', color: '#aaaaff' }}>{option.description}</span>
                </span>
                <span style={{ color: '#55ff55', fontWeight: 'bold' }}>{option.cost}L</span>
              </button>
            )) : (
              <div style={{
                minHeight: '132px',
                background: '#7f7f7f',
                border: '2px solid #555',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#333',
                fontSize: '13px',
                textAlign: 'center',
                padding: '12px',
              }}>
                Place an enchantable tool, weapon, or armor piece here.
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: '12px', marginBottom: '8px', color: '#444' }}>Inventory</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 48px)', gap: '2px' }}>
          {Array.from({ length: INVENTORY_SIZE }, (_, i) => (
            <React.Fragment key={i}>
              {renderSlot(inventory.getSlot(i), () => handleInventorySlotClick(i))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {heldItem && (
        <div
          id="enchant-held-item"
          style={{
            position: 'fixed',
            width: SLOT_SIZE,
            height: SLOT_SIZE,
            pointerEvents: 'none',
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={getItemIconStyle(heldItem.id, 32)} />
        </div>
      )}

      {hoveredItem && !heldItem && (
        <div style={{
          position: 'fixed',
          left: `${hoveredItem.x + 12}px`,
          top: `${hoveredItem.y - 12}px`,
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
          minWidth: '130px',
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
            {hoveredItem.item.customName || getLocalizedItemName(hoveredItem.item.id, ItemRegistry.get(hoveredItem.item.id)?.displayName)}
          </span>
          {hoveredItem.item.enchantments?.map((enchantment) => (
            <span key={enchantment.id} style={{ color: '#aaaaff', fontSize: '10px' }}>
              {EnchantSystem.getDisplayName(enchantment)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
