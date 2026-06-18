import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemStack } from '../types';
import { EnchantSystem } from '../systems/EnchantSystem';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory, INVENTORY_SIZE } from '../player/Inventory';
import { useI18n } from '../i18n';

interface AnvilUIProps {
  inventory: Inventory;
  xpLevel: number;
  gameMode: 'survival' | 'creative';
  onClose: () => void;
  onInventoryChange: () => void;
  onSpendLevels: (cost: number) => boolean;
  getItemIconStyle: (id: number, size?: number) => any;
}

const SLOT_SIZE = 48;

export const AnvilUI: React.FC<AnvilUIProps> = ({
  inventory,
  xpLevel,
  gameMode,
  onClose,
  onInventoryChange,
  onSpendLevels,
  getItemIconStyle,
}) => {
  const { getLocalizedItemName } = useI18n();
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [leftSlot, setLeftSlot] = useState<ItemStack | null>(null);
  const [rightSlot, setRightSlot] = useState<ItemStack | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [hoveredItem, setHoveredItem] = useState<{ item: ItemStack; x: number; y: number } | null>(null);

  const result = useMemo((): { item: ItemStack; cost: number } | null => {
    if (!leftSlot) return null;
    const itemDef = ItemRegistry.get(leftSlot.id);
    if (!itemDef) return null;

    const output: ItemStack = {
      ...leftSlot,
      count: 1,
      enchantments: leftSlot.enchantments ? [...leftSlot.enchantments] : undefined,
    };
    let cost = 0;
    const cleanName = nameValue.trim();
    const defaultName = getLocalizedItemName(leftSlot.id, itemDef.displayName);
    const currentName = leftSlot.customName ?? defaultName;

    if (rightSlot) {
      if (rightSlot.id !== leftSlot.id) return null;
      const maxDurability = itemDef.durability;
      if (maxDurability && leftSlot.durability !== undefined && rightSlot.durability !== undefined) {
        const repaired = Math.min(maxDurability, leftSlot.durability + rightSlot.durability + Math.floor(maxDurability * 0.12));
        if (repaired > leftSlot.durability) {
          output.durability = repaired;
          cost += 2;
        }
      }

      const merged = EnchantSystem.mergeEnchantments(leftSlot, rightSlot);
      const before = JSON.stringify(leftSlot.enchantments ?? []);
      const after = JSON.stringify(merged);
      if (before !== after) {
        output.enchantments = merged;
        cost += Math.max(1, merged.length);
      }
    }

    if (cleanName !== currentName) {
      output.customName = cleanName;
      cost += 1;
      if (!cleanName || cleanName === defaultName) {
        delete output.customName;
      }
    }

    if (cost <= 0) return null;
    return { item: output, cost };
  }, [getLocalizedItemName, leftSlot, nameValue, rightSlot]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const held = document.getElementById('anvil-held-item');
      if (held) {
        held.style.left = `${e.clientX - SLOT_SIZE / 2}px`;
        held.style.top = `${e.clientY - SLOT_SIZE / 2}px`;
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    if (!leftSlot) {
      setNameValue('');
    } else {
      const def = ItemRegistry.get(leftSlot.id);
      setNameValue(leftSlot.customName ?? getLocalizedItemName(leftSlot.id, def?.displayName));
    }
  }, [getLocalizedItemName, leftSlot]);

  const returnLocalItems = useCallback(() => {
    if (heldItem) inventory.addItem(heldItem.id, heldItem.count);
    if (leftSlot) inventory.addItem(leftSlot.id, leftSlot.count);
    if (rightSlot) inventory.addItem(rightSlot.id, rightSlot.count);
    setHeldItem(null);
    setLeftSlot(null);
    setRightSlot(null);
    onInventoryChange();
  }, [heldItem, inventory, leftSlot, onInventoryChange, rightSlot]);

  const handleClose = useCallback(() => {
    returnLocalItems();
    onClose();
  }, [onClose, returnLocalItems]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (isTyping && e.key !== 'Escape') return;
      if (e.key.toLowerCase() === 'e' || e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const sameStackKind = (a: ItemStack, b: ItemStack) => {
    return a.id === b.id &&
      a.customName === b.customName &&
      JSON.stringify(a.enchantments ?? []) === JSON.stringify(b.enchantments ?? []);
  };

  const setLocalSlot = (slot: 'left' | 'right', item: ItemStack | null) => {
    if (slot === 'left') setLeftSlot(item);
    else setRightSlot(item);
  };

  const getLocalSlot = (slot: 'left' | 'right') => slot === 'left' ? leftSlot : rightSlot;

  const handleLocalSlotClick = (slot: 'left' | 'right') => {
    const current = getLocalSlot(slot);
    if (heldItem && !current) {
      setLocalSlot(slot, heldItem);
      setHeldItem(null);
    } else if (!heldItem && current) {
      setHeldItem(current);
      setLocalSlot(slot, null);
    } else if (heldItem && current) {
      setLocalSlot(slot, heldItem);
      setHeldItem(current);
    }
    onInventoryChange();
  };

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

  const handleTakeResult = () => {
    if (!result) return;
    if (gameMode !== 'creative' && xpLevel < result.cost) return;
    if (!onSpendLevels(result.cost)) return;
    setHeldItem(result.item);
    setLeftSlot(null);
    setRightSlot(null);
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
        background: special ? '#9a9a9a' : '#8b8b8b',
        border: '2px solid',
        borderColor: '#373737 #fff #fff #373737',
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
            <span style={{ position: 'absolute', bottom: 1, right: 3, color: '#fff', fontSize: '11px', fontWeight: 'bold', textShadow: '1px 1px 0 #000' }}>
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
        <div style={{ fontSize: '14px', marginBottom: '12px', color: '#333', fontWeight: 'bold' }}>Anvil</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          {renderSlot(leftSlot, () => handleLocalSlotClick('left'), true)}
          <span style={{ fontSize: '22px', color: '#555' }}>+</span>
          {renderSlot(rightSlot, () => handleLocalSlotClick('right'), true)}
          <span style={{ fontSize: '22px', color: '#555' }}>→</span>
          {renderSlot(result?.item ?? null, handleTakeResult, true)}
          <div style={{ color: result ? '#208020' : '#555', fontSize: '12px', minWidth: '120px' }}>
            {result ? `${result.cost} level${result.cost === 1 ? '' : 's'}` : 'No repair'}
          </div>
        </div>

        <input
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          disabled={!leftSlot}
          maxLength={32}
          placeholder="Item name"
          style={{
            width: '260px',
            height: '32px',
            marginBottom: '18px',
            padding: '0 10px',
            boxSizing: 'border-box',
            background: '#1f1f1f',
            border: '2px solid #555',
            color: '#fff',
            fontFamily: '"Courier New", monospace',
            fontSize: '12px',
            outline: 'none',
            opacity: leftSlot ? 1 : 0.45,
          }}
        />

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
          id="anvil-held-item"
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
