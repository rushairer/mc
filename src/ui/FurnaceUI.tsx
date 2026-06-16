import React, { useState, useCallback, useEffect } from 'react';
import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { Inventory } from '../player/Inventory';
import { findSmeltingResult } from '../items/SmeltingRecipes';

interface FurnaceUIProps {
  inventory: Inventory;
  onClose: () => void;
  onInventoryChange: () => void;
}

const SLOT_SIZE = 48;

export const FurnaceUI: React.FC<FurnaceUIProps> = ({ inventory, onClose, onInventoryChange }) => {
  const [inputSlot, setInputSlot] = useState<ItemStack | null>(null);
  const [fuelSlot, setFuelSlot] = useState<ItemStack | null>(null);
  const [outputSlot, setOutputSlot] = useState<ItemStack | null>(null);
  const [isSmelting, setIsSmelting] = useState(false);
  const [smeltProgress, setSmeltProgress] = useState(0);
  const [fuelProgress, setFuelProgress] = useState(0);

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
    const isFuel = fuelSlot.id === 101 || fuelSlot.id === 5 || fuelSlot.id === 6;
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

  const renderSlot = (item: ItemStack | null, onClick: () => void) => {
    const itemDef = item ? ItemRegistry.get(item.id) : null;
    return (
      <div
        onClick={onClick}
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
            <span style={{ fontSize: '8px' }}>{itemDef.displayName}</span>
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
      }}>
        <div style={{ fontSize: '14px', marginBottom: '12px', color: '#aaa' }}>Furnace</div>

        {/* Input → Output */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Input</div>
            {renderSlot(inputSlot, () => {
              if (!inputSlot) return;
              inventory.addItem(inputSlot.id, inputSlot.count);
              setInputSlot(null);
              onInventoryChange();
            })}
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Fuel</div>
            {renderSlot(fuelSlot, () => {
              if (!fuelSlot) return;
              inventory.addItem(fuelSlot.id, fuelSlot.count);
              setFuelSlot(null);
              onInventoryChange();
            })}
          </div>
          <div style={{ fontSize: '20px', color: '#aaa' }}>→</div>
          <div>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Output</div>
            {renderSlot(outputSlot, () => {
              if (!outputSlot) return;
              inventory.addItem(outputSlot.id, outputSlot.count);
              setOutputSlot(null);
              onInventoryChange();
            })}
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
        <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>Inventory</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(9, ${SLOT_SIZE}px)`,
          gap: '2px',
        }}>
          {Array.from({ length: 36 }, (_, i) => {
            const item = inventory.getSlot(i);
            return (
              <div
                key={i}
                onClick={() => {
                  if (!item) return;
                  const recipe = findSmeltingResult(item.id);
                  const isFuel = item.id === 101 || item.id === 5 || item.id === 6;

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
                {item && ItemRegistry.get(item.id) && (
                  <>
                    <span style={{ fontSize: '8px' }}>{ItemRegistry.getDisplayName(item.id)}</span>
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
    </div>
  );
};
