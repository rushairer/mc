import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemStack } from '../types';
import { BrewingSystem } from '../systems/BrewingSystem';
import { PotionEffects } from '../systems/PotionEffect';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory, INVENTORY_SIZE } from '../player/Inventory';
import { useI18n } from '../i18n';

interface BrewingUIProps {
  inventory: Inventory;
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
}

const SLOT_SIZE = 48;
const BLAZE_POWDER_ID = 377;

export const BrewingUI: React.FC<BrewingUIProps> = ({ inventory, onClose, onInventoryChange, getItemIconStyle }) => {
  const { t, getLocalizedItemName, getLocalizedDisplayName, getLocalizedCategory } = useI18n();
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [bottles, setBottles] = useState<Array<ItemStack | null>>([null, null, null]);
  const [ingredient, setIngredient] = useState<ItemStack | null>(null);
  const [fuel, setFuel] = useState<ItemStack | null>(null);
  const [progress, setProgress] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<{ item: ItemStack; x: number; y: number } | null>(null);

  const recipe = useMemo(() => BrewingSystem.findRecipe(ingredient, bottles), [ingredient, bottles]);
  const canBrew = !!recipe && !!fuel && fuel.id === BLAZE_POWDER_ID;

  useEffect(() => {
    if (!canBrew || !recipe) {
      setProgress(0);
      return;
    }

    const interval = setInterval(() => {
      setProgress((current) => {
        const next = current + 0.025;
        if (next < 1) return next;

        setBottles((prev) => prev.map((bottle) => bottle ? BrewingSystem.brewBottle(bottle, recipe) : null));
        setIngredient((prev) => prev ? { ...prev, count: prev.count - 1 } : null);
        setFuel((prev) => prev ? { ...prev, count: prev.count - 1 } : null);
        onInventoryChange();
        return 0;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [canBrew, onInventoryChange, recipe]);

  useEffect(() => {
    if (ingredient && ingredient.count <= 0) setIngredient(null);
    if (fuel && fuel.count <= 0) setFuel(null);
  }, [fuel, ingredient]);

  const returnLocalItems = useCallback(() => {
    if (heldItem) inventory.addStack(heldItem);
    if (ingredient) inventory.addStack(ingredient);
    if (fuel) inventory.addStack(fuel);
    for (const bottle of bottles) {
      if (bottle) inventory.addStack(bottle);
    }
    setHeldItem(null);
    setIngredient(null);
    setFuel(null);
    setBottles([null, null, null]);
    onInventoryChange();
  }, [bottles, fuel, heldItem, ingredient, inventory, onInventoryChange]);

  const handleClose = useCallback(() => {
    returnLocalItems();
    onClose();
  }, [onClose, returnLocalItems]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const held = document.getElementById('brewing-held-item');
      if (held) {
        held.style.left = `${e.clientX - SLOT_SIZE / 2}px`;
        held.style.top = `${e.clientY - SLOT_SIZE / 2}px`;
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

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
    return a.id === b.id &&
      a.customName === b.customName &&
      JSON.stringify(a.enchantments ?? []) === JSON.stringify(b.enchantments ?? []) &&
      JSON.stringify(a.potion ?? null) === JSON.stringify(b.potion ?? null);
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

  const handleMachineSlotClick = (kind: 'ingredient' | 'fuel' | 'bottle', index = 0) => {
    const current = kind === 'ingredient' ? ingredient : kind === 'fuel' ? fuel : bottles[index];
    const acceptsHeld = !heldItem ||
      kind === 'ingredient' ||
      (kind === 'fuel' && heldItem.id === BLAZE_POWDER_ID) ||
      (kind === 'bottle' && BrewingSystem.isBottle(heldItem));

    if (!acceptsHeld) return;

    if (heldItem && !current) {
      const placed = kind === 'bottle' && heldItem.id === 374
        ? BrewingSystem.createWaterPotion()
        : { ...heldItem, count: 1 };
      const leftover = heldItem.count - 1;
      if (kind === 'ingredient') setIngredient(placed);
      else if (kind === 'fuel') setFuel(placed);
      else setBottles((prev) => prev.map((slot, i) => i === index ? placed : slot));
      setHeldItem(leftover > 0 ? { ...heldItem, count: leftover } : null);
    } else if (!heldItem && current) {
      if (kind === 'ingredient') setIngredient(null);
      else if (kind === 'fuel') setFuel(null);
      else setBottles((prev) => prev.map((slot, i) => i === index ? null : slot));
      setHeldItem(current);
    } else if (heldItem && current) {
      if (kind === 'ingredient') setIngredient(heldItem);
      else if (kind === 'fuel') setFuel(heldItem);
      else setBottles((prev) => prev.map((slot, i) => i === index ? heldItem : slot));
      setHeldItem(current);
    }
    onInventoryChange();
  };

  const renderPotionLines = (item: ItemStack) => {
    if (!item.potion?.effect) return null;
    const effect = item.potion.effect;
    return (
      <span style={{ color: '#aaaaff', fontSize: '10px' }}>
        {PotionEffects.format(effect)} {effect.duration > 0 ? `${Math.ceil(effect.duration)}s` : ''}
      </span>
    );
  };

  const renderSlot = (item: ItemStack | null, onClick: () => void, label?: string) => {
    const itemDef = item ? ItemRegistry.get(item.id) : null;
    return (
      <div>
        <div
          onClick={onClick}
          onMouseEnter={(e) => item && setHoveredItem({ item, x: e.clientX, y: e.clientY })}
          onMouseMove={(e) => item && setHoveredItem({ item, x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setHoveredItem(null)}
          style={{
            width: SLOT_SIZE,
            height: SLOT_SIZE,
            background: '#8b8b8b',
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
          {item && itemDef && (
            <>
              <div style={getItemIconStyle(item.id, 34)} />
              {item.count > 1 && (
                <span style={{ position: 'absolute', bottom: 1, right: 3, color: '#fff', fontSize: '11px', fontWeight: 'bold', textShadow: '1px 1px 0 #000' }}>
                  {item.count}
                </span>
              )}
            </>
          )}
        </div>
        {label && <div style={{ marginTop: 4, color: '#555', fontSize: '10px', textAlign: 'center' }}>{label}</div>}
      </div>
    );
  };

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
        <div style={{ fontSize: '14px', marginBottom: '12px', color: '#333', fontWeight: 'bold' }}>{getLocalizedDisplayName('Brewing Stand')}</div>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center', marginBottom: 18 }}>
          {renderSlot(fuel, () => handleMachineSlotClick('fuel'), t('fuel'))}
          <div style={{ width: 28, height: 110, background: '#222', border: '2px solid #555', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: `${progress * 100}%`,
              background: 'linear-gradient(180deg, #7d55ff, #4b238c)',
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {renderSlot(ingredient, () => handleMachineSlotClick('ingredient'), t('brewingIngredient'))}
            <div style={{ display: 'flex', gap: 12 }}>
              {bottles.map((bottle, i) => (
                <React.Fragment key={i}>
                  {renderSlot(bottle, () => handleMachineSlotClick('bottle', i), t('brewingBottle'))}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div style={{ color: canBrew ? '#206020' : '#555', fontSize: 12, minWidth: 150 }}>
            {canBrew && recipe ? getLocalizedDisplayName(recipe.outputName) : t('brewingNeeds')}
          </div>
        </div>

        <div style={{ fontSize: '12px', marginBottom: '8px', color: '#444' }}>{t('inventory')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 48px)', gap: '2px' }}>
          {Array.from({ length: INVENTORY_SIZE }, (_, i) => (
            <React.Fragment key={i}>
              {renderSlot(inventory.getSlot(i), () => handleInventorySlotClick(i))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {heldItem && (
        <div id="brewing-held-item" style={{
          position: 'fixed',
          width: SLOT_SIZE,
          height: SLOT_SIZE,
          pointerEvents: 'none',
          zIndex: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
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
            {hoveredItem.item.customName || (hoveredItem.item.potion?.name ? getLocalizedDisplayName(hoveredItem.item.potion.name) : getLocalizedItemName(hoveredItem.item.id, ItemRegistry.get(hoveredItem.item.id)?.displayName))}
          </span>
          <span style={{ color: '#888888', fontSize: '10px', textTransform: 'capitalize' }}>
            {getLocalizedCategory(ItemRegistry.get(hoveredItem.item.id)?.category ?? 'material')}
          </span>
          {renderPotionLines(hoveredItem.item)}
        </div>
      )}
    </div>
  );
};
