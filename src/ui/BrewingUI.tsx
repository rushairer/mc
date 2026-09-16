import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemStack } from '../types';
import { BrewingSystem } from '../systems/BrewingSystem';
import { PotionEffects } from '../systems/PotionEffect';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory, INVENTORY_SIZE } from '../player/Inventory';
import { useI18n } from '../i18n';

interface BrewingUIProps {
  inventory: Inventory;
  brewingSlots: (ItemStack | null)[];
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
}

const SLOT_SIZE = 48;
const BLAZE_POWDER_ID = 377;

export const BrewingUI: React.FC<BrewingUIProps> = ({ inventory, brewingSlots, onClose, onInventoryChange, getItemIconStyle }) => {
  const { t, getLocalizedItemName, getLocalizedDisplayName, getLocalizedCategory } = useI18n();
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [bottles, setBottles] = useState<Array<ItemStack | null>>([brewingSlots[0], brewingSlots[1], brewingSlots[2]]);
  const [ingredient, setIngredient] = useState<ItemStack | null>(brewingSlots[3]);
  const [fuel, setFuel] = useState<ItemStack | null>(brewingSlots[4]);

  useEffect(() => {
    brewingSlots[0] = bottles[0];
    brewingSlots[1] = bottles[1];
    brewingSlots[2] = bottles[2];
    onInventoryChange();
  }, [bottles, brewingSlots, onInventoryChange]);

  useEffect(() => {
    brewingSlots[3] = ingredient;
    onInventoryChange();
  }, [ingredient, brewingSlots, onInventoryChange]);

  useEffect(() => {
    brewingSlots[4] = fuel;
    onInventoryChange();
  }, [fuel, brewingSlots, onInventoryChange]);

  const [progress, setProgress] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<{ item: ItemStack; x: number; y: number } | null>(null);

  const action = useMemo(() => BrewingSystem.findBrewAction(ingredient, bottles), [ingredient, bottles]);
  const canBrew = !!action && !!fuel && fuel.id === BLAZE_POWDER_ID;

  useEffect(() => {
    if (!canBrew || !action) {
      setProgress(0);
      return;
    }

    const interval = setInterval(() => {
      setProgress((current) => {
        const next = current + 0.025;
        if (next < 1) return next;

        setBottles((prev) => prev.map((bottle) => {
          if (!bottle) return null;
          return action.kind === 'brew'
            ? BrewingSystem.brewBottle(bottle, action.recipe)
            : action.modifier.modify(bottle);
        }));
        setIngredient((prev) => {
          const consumed = BrewingSystem.consumeIngredient(prev);
          if (consumed.returnedContainer) {
            const leftover = inventory.addStack(consumed.returnedContainer);
            if (leftover) {
              setHeldItem((held) => held ?? leftover);
            }
          }
          return consumed.ingredient;
        });
        setFuel((prev) => prev ? { ...prev, count: prev.count - 1 } : null);
        onInventoryChange();
        return 0;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [canBrew, onInventoryChange, action, inventory]);

  useEffect(() => {
    if (ingredient && ingredient.count <= 0) setIngredient(null);
    if (fuel && fuel.count <= 0) setFuel(null);
  }, [fuel, ingredient]);

  const handleClose = useCallback(() => {
    if (heldItem) {
      inventory.addStack(heldItem);
      setHeldItem(null);
    }
    onClose();
  }, [heldItem, inventory, onClose]);

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

  const invSlots = Array.from({ length: INVENTORY_SIZE }, (_, i) => inventory.getSlot(i));

  return (
    <div className="ui-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
      <div style={{ background: '#c6c6c6', padding: '18px 20px 22px', border: '3px solid', borderColor: '#fff #555 #555 #fff', minWidth: 520, color: '#222', fontFamily: 'monospace', position: 'relative' }}>
        <div style={{ fontSize: 16, marginBottom: 14 }}>{t('ui.brewing.title', 'Brewing Stand')}</div>
        <button onClick={handleClose} style={{ position: 'absolute', right: 8, top: 8 }}>×</button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', alignItems: 'end', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {renderSlot(fuel, () => handleMachineSlotClick('fuel'), t('ui.brewing.fuel', 'Fuel'))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {renderSlot(ingredient, () => handleMachineSlotClick('ingredient'), t('ui.brewing.ingredient', 'Ingredient'))}
            <div style={{ width: 150, height: 10, background: '#777', border: '1px solid #333' }}>
              <div style={{ width: `${Math.min(1, progress) * 100}%`, height: '100%', background: '#555' }} />
            </div>
          </div>
          <div />
        </div>
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginBottom: 18 }}>
          {bottles.map((bottle, i) => (
            <React.Fragment key={i}>
              {renderSlot(bottle, () => handleMachineSlotClick('bottle', i), `${t('ui.brewing.bottle', 'Bottle')} ${i + 1}`)}
            </React.Fragment>
          ))}
        </div>
        <div style={{ fontSize: 13, margin: '10px 0 7px' }}>{t('ui.inventory', 'Inventory')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 42px)', gap: 2 }}>
          {invSlots.map((slot, i) => (
            <div key={i} onClick={() => handleInventorySlotClick(i)} style={{ width: 42, height: 42, background: '#8b8b8b', border: '2px solid', borderColor: '#373737 #fff #fff #373737', boxSizing: 'border-box', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {slot && ItemRegistry.get(slot.id) && <div style={getItemIconStyle(slot.id, 30)} />}
              {slot && slot.count > 1 && <span style={{ position: 'absolute', right: 2, bottom: 1, color: '#fff', fontSize: 10, textShadow: '1px 1px #000' }}>{slot.count}</span>}
            </div>
          ))}
        </div>
      </div>
      {heldItem && (
        <div id="brewing-held-item" style={{ position: 'fixed', pointerEvents: 'none', zIndex: 1300, width: SLOT_SIZE, height: SLOT_SIZE }}>
          <div style={getItemIconStyle(heldItem.id, 34)} />
          {heldItem.count > 1 && <span style={{ position: 'absolute', right: 2, bottom: 0, color: '#fff', fontSize: 11, textShadow: '1px 1px #000' }}>{heldItem.count}</span>}
        </div>
      )}
      {hoveredItem && (
        <div style={{ position: 'fixed', left: hoveredItem.x + 12, top: hoveredItem.y + 12, zIndex: 1400, background: 'rgba(20,10,35,0.95)', color: '#fff', border: '1px solid #2f0a4f', padding: '5px 7px', pointerEvents: 'none', fontFamily: 'monospace', fontSize: 11 }}>
          <div>{getLocalizedDisplayName(hoveredItem.item) || getLocalizedItemName(hoveredItem.item.id)}</div>
          {renderPotionLines(hoveredItem.item)}
          <div style={{ color: '#777' }}>{getLocalizedCategory(ItemRegistry.get(hoveredItem.item.id)?.category ?? '')}</div>
        </div>
      )}
    </div>
  );
};