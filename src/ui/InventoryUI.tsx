import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { BlockRegistry } from '../world/BlockRegistry';
import { Inventory, HOTBAR_SIZE, INVENTORY_SIZE } from '../player/Inventory';
import { findCraftingResult } from '../items/CraftingRecipes';
import { useI18n } from '../i18n';
import { EnchantSystem } from '../systems/EnchantSystem';
import { PotionEffects } from '../systems/PotionEffect';

interface InventoryUIProps {
  inventory: Inventory;
  onClose: () => void;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
  gameMode?: 'survival' | 'creative';
  onDropItem?: (itemId: number, count: number) => void;
}

const SLOT_SIZE = 48;

let cachedCreativeItems: number[] | null = null;

function getCreativeItems(): number[] {
  if (cachedCreativeItems) return cachedCreativeItems;

  const blocksList = BlockRegistry.all()
    .filter(b => {
      if (b.id === 0 || BlockRegistry.isFluid(b.id) || b.name.includes('double_') || b.name === 'moving_piston') {
        return false;
      }
      // Exclude facing/rotation/state variations.
      // If it's a packed ID (has metadata), check if it's identical in function to the base ID block.
      const baseId = b.baseId ?? (b.id & 0x3FF);
      if (b.metadata !== undefined && b.metadata > 0 && b.id !== baseId) {
        const baseBlock = BlockRegistry.get(baseId);
        if (baseBlock) {
          if (baseBlock.name === b.name ||
              b.name.includes('facing') ||
              baseBlock.name.includes('door') ||
              baseBlock.name.includes('stairs') ||
              baseBlock.name.includes('piston') ||
              baseBlock.name.includes('repeater') ||
              baseBlock.name.includes('lever') ||
              baseBlock.name.includes('furnace')) {
            return false;
          }
        }
      }
      return true;
    })
    .map(b => b.id);

  const itemsList = ItemRegistry.all()
    .filter(item => item.id !== 0)
    .map(item => item.id);

  cachedCreativeItems = Array.from(new Set([...blocksList, ...itemsList]));
  return cachedCreativeItems;
}

export const InventoryUI: React.FC<InventoryUIProps> = ({ inventory, onClose, onInventoryChange, getItemIconStyle, gameMode = 'survival', onDropItem }) => {
  const { t, getLocalizedItemName, getLocalizedDisplayName, getLocalizedCategory } = useI18n();
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [craftingGrid, setCraftingGrid] = useState<number[]>(new Array(4).fill(0));
  const [craftResult, setCraftResult] = useState<{ id: number; count: number } | null>(null);
  const [creativeSearch, setCreativeSearch] = useState('');
  const [hoveredSlot, setHoveredSlot] = useState<{
    item: ItemStack;
    itemDef: any;
    x: number;
    y: number;
    index: number;
    type: 'inventory' | 'armor' | 'crafting';
  } | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  const creativeItems = React.useMemo(() => getCreativeItems(), []);

  const filteredCreativeItems = React.useMemo(() => {
    const query = creativeSearch.trim().toLowerCase();
    if (!query) return creativeItems;

    return creativeItems.filter((id) => {
      const itemDef = ItemRegistry.get(id);
      if (!itemDef) return false;
      const localizedName = getLocalizedItemName(id, itemDef.displayName);
      return [
        String(id),
        itemDef.name,
        itemDef.displayName,
        localizedName,
        itemDef.category,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [creativeItems, creativeSearch, getLocalizedItemName]);

  const [visibleCount, setVisibleCount] = useState(60);

  useEffect(() => {
    setVisibleCount(60);
  }, [creativeSearch]);

  const handleCatalogScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 40) {
      setVisibleCount(prev => Math.min(prev + 60, filteredCreativeItems.length));
    }
  }, [filteredCreativeItems.length]);

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

  const handleArmorSlotClick = useCallback((armorSlotIndex: number) => {
    const expectedSlots: ('helmet' | 'chestplate' | 'leggings' | 'boots')[] = ['helmet', 'chestplate', 'leggings', 'boots'];
    const expectedSlotType = expectedSlots[armorSlotIndex];

    const currentArmorItem = (inventory.armor && Array.isArray(inventory.armor)) ? inventory.armor[armorSlotIndex] : null;

    if (heldItem) {
      const itemDef = ItemRegistry.get(heldItem.id);
      if (itemDef && itemDef.category === 'armor' && itemDef.armorSlot === expectedSlotType) {
        if (!inventory.armor || !Array.isArray(inventory.armor)) {
          inventory.armor = new Array(4).fill(null);
        }
        inventory.armor[armorSlotIndex] = heldItem;
        setHeldItem(currentArmorItem);
      }
    } else if (currentArmorItem) {
      setHeldItem(currentArmorItem);
      if (!inventory.armor || !Array.isArray(inventory.armor)) {
        inventory.armor = new Array(4).fill(null);
      }
      inventory.armor[armorSlotIndex] = null;
    }

    onInventoryChange();
  }, [heldItem, inventory, onInventoryChange]);

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

  // Close on E or Escape key, drop on Q
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (isTyping && e.key !== 'Escape') return;

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
          onInventoryChange();
        } else if (hoveredSlot) {
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
          } else if (type === 'armor') {
            const armorItem = inventory.armor?.[index];
            if (armorItem) {
              const dropCount = (e.ctrlKey || e.metaKey || e.shiftKey) ? armorItem.count : 1;
              onDropItem?.(armorItem.id, dropCount);
              if (armorItem.count <= dropCount) {
                inventory.armor[index] = null;
                setHoveredSlot(null);
              } else {
                armorItem.count -= dropCount;
                setHoveredSlot({ ...hoveredSlot, item: { ...armorItem } });
              }
              onInventoryChange();
            }
          }
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose, heldItem, hoveredSlot, inventory, onDropItem, onInventoryChange]);

  const armorPlaceholders = [
    <svg key="helmet" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25, color: '#fff' }}>
      <path d="M2 10a10 10 0 0 1 20 0v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-1a2 2 0 0 0-4 0v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
    </svg>,
    <svg key="chestplate" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25, color: '#fff' }}>
      <path d="M12 22v-9" />
      <path d="M5 3h14l2 5v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
      <path d="M8 3v4a4 4 0 0 0 8 0V3" />
    </svg>,
    <svg key="leggings" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25, color: '#fff' }}>
      <path d="M4 3h16v8h-6v10h-4V11H4z" />
    </svg>,
    <svg key="boots" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25, color: '#fff' }}>
      <path d="M4 4v12l4 4h4v-8H4" />
      <path d="M20 4v12l-4 4h-4v-8h8" />
    </svg>
  ];

  const renderSlot = (
    item: ItemStack | null,
    index: number,
    onClick: () => void,
    highlight?: boolean,
    placeholder?: React.ReactNode,
    slotType: 'inventory' | 'armor' | 'crafting' = 'inventory'
  ) => {
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
              index,
              type: slotType
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
              index,
              type: slotType
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
        {item && itemDef ? (
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
        ) : (
          placeholder
        )}
      </div>
    );
  };

  const renderPlayerPreview = () => {
    const helmet = (inventory.armor && Array.isArray(inventory.armor)) ? inventory.armor[0] : null;
    const chestplate = (inventory.armor && Array.isArray(inventory.armor)) ? inventory.armor[1] : null;
    const leggings = (inventory.armor && Array.isArray(inventory.armor)) ? inventory.armor[2] : null;
    const boots = (inventory.armor && Array.isArray(inventory.armor)) ? inventory.armor[3] : null;

    const getArmorColor = (item: ItemStack | null) => {
      if (!item) return null;
      const def = ItemRegistry.get(item.id);
      if (!def) return null;
      return def.name.startsWith('iron_') ? '#d8d8d8' : '#55ffff';
    };

    const helmetColor = getArmorColor(helmet);
    const chestplateColor = getArmorColor(chestplate);
    const leggingsColor = getArmorColor(leggings);
    const bootsColor = getArmorColor(boots);

    return (
      <div style={{
        width: '100px',
        height: '202px',
        border: '2px solid #555',
        background: 'rgba(20,20,20,0.6)',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Courier New", monospace',
        boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px', textShadow: '1px 1px 0 #000' }}>Preview</div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          {/* Head & Helmet */}
          <div style={{
            width: '24px',
            height: '24px',
            background: '#FFCC99',
            border: '1px solid rgba(0,0,0,0.25)',
            position: 'relative',
            boxSizing: 'border-box',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: '#553311' }} />
            <div style={{ position: 'absolute', top: '10px', left: '3px', width: '3px', height: '2px', background: '#0000FF' }} />
            <div style={{ position: 'absolute', top: '10px', right: '3px', width: '3px', height: '2px', background: '#0000FF' }} />
            {helmetColor && (
              <div style={{
                position: 'absolute',
                top: '-2px',
                left: '-2px',
                right: '-2px',
                bottom: '-2px',
                border: `2px solid ${helmetColor}`,
                background: 'rgba(0,0,0,0.1)',
                boxSizing: 'border-box',
              }}>
                <div style={{ position: 'absolute', bottom: 0, left: '6px', right: '6px', height: '4px', background: helmetColor }} />
              </div>
            )}
          </div>

          {/* Middle Row: Arms and Torso */}
          <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '2px' }}>
            <div style={{
              width: '10px',
              height: '36px',
              background: chestplateColor || '#008080',
              border: '1px solid rgba(0,0,0,0.25)',
              borderRight: 'none',
              boxSizing: 'border-box',
              position: 'relative',
            }}>
              {chestplateColor && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '10px', background: '#FFCC99' }} />
              )}
            </div>

            <div style={{
              width: '24px',
              height: '36px',
              background: chestplateColor || '#008080',
              border: '1px solid rgba(0,0,0,0.25)',
              boxSizing: 'border-box',
              position: 'relative',
            }}>
              {!chestplateColor && (
                <div style={{ position: 'absolute', top: 0, left: '6px', width: '10px', height: '4px', background: '#FFCC99' }} />
              )}
            </div>

            <div style={{
              width: '10px',
              height: '36px',
              background: chestplateColor || '#008080',
              border: '1px solid rgba(0,0,0,0.25)',
              borderLeft: 'none',
              boxSizing: 'border-box',
              position: 'relative',
            }}>
              {chestplateColor && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '10px', background: '#FFCC99' }} />
              )}
            </div>
          </div>

          {/* Bottom Row: Legs */}
          <div style={{ display: 'flex', marginTop: '2px' }}>
            <div style={{
              width: '11px',
              height: '40px',
              background: leggingsColor || '#2244AA',
              border: '1px solid rgba(0,0,0,0.25)',
              borderRight: 'none',
              boxSizing: 'border-box',
              position: 'relative',
            }}>
              {bootsColor && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '12px', background: bootsColor }} />
              )}
            </div>

            <div style={{
              width: '11px',
              height: '40px',
              background: leggingsColor || '#2244AA',
              border: '1px solid rgba(0,0,0,0.25)',
              borderLeft: 'none',
              boxSizing: 'border-box',
              position: 'relative',
            }}>
              {bootsColor && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '12px', background: bootsColor }} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={() => {
        if (heldItem) {
          onDropItem?.(heldItem.id, heldItem.count);
          setHeldItem(null);
          onInventoryChange();
        }
      }}
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
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        {/* Creative Item Catalog */}
        {gameMode === 'creative' && (
          <div style={{
            marginRight: '20px',
            width: '320px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ fontSize: '14px', marginBottom: '8px', color: '#ffaa00', fontWeight: 'bold' }}>{t('creativeCatalog')}</div>
            <input
              value={creativeSearch}
              onChange={(e) => setCreativeSearch(e.target.value)}
              placeholder={t('creativeSearchPlaceholder')}
              style={{
                height: '32px',
                marginBottom: '8px',
                padding: '0 10px',
                boxSizing: 'border-box',
                background: '#1f1f1f',
                border: '2px solid #555',
                borderTopColor: '#222',
                borderLeftColor: '#222',
                color: '#fff',
                fontFamily: '"Courier New", monospace',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            <div
              onScroll={handleCatalogScroll}
              style={{
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
              }}
            >
              {filteredCreativeItems.slice(0, visibleCount).map((id) => {
                const itemDef = ItemRegistry.get(id);
                const itemName = itemDef ? getLocalizedItemName(id, itemDef.displayName) : String(id);
                return (
                  <button
                    key={id}
                    onClick={() => handleCatalogClick(id)}
                    title={itemName}
                    aria-label={itemName}
                    onMouseEnter={(e) => {
                      if (itemDef && !heldItem) {
                        setHoveredSlot({
                          item: { id, count: 1 },
                          itemDef,
                          x: e.clientX,
                          y: e.clientY,
                          index: -1,
                          type: 'inventory'
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
                          index: -1,
                          type: 'inventory'
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
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={getItemIconStyle(id, 32)} />
                  </button>
                );
              })}
              {filteredCreativeItems.length === 0 && (
                <div style={{
                  gridColumn: '1 / -1',
                  minHeight: '96px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#aaa',
                  fontSize: '12px',
                  textAlign: 'center',
                }}>
                  {t('creativeNoResults')}
                </div>
              )}
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
          title={t('closeEsc')}
        >
          X
        </button>
        {/* Upper row: Armor & Crafting (Survival) or Armor only (Creative) */}
        <div style={{ display: 'flex', gap: '32px', marginBottom: '16px', alignItems: 'flex-start' }}>
          {/* Armor Slots */}
          <div>
            <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>{t('armor')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {Array.from({ length: 4 }, (_, i) =>
                renderSlot(
                  (inventory.armor && Array.isArray(inventory.armor)) ? inventory.armor[i] : null,
                  i,
                  () => handleArmorSlotClick(i),
                  false,
                  armorPlaceholders[i],
                  'armor'
                )
              )}
            </div>
          </div>

          {/* Player Preview */}
          {renderPlayerPreview()}

          {/* Crafting area */}
          {gameMode === 'survival' && (
            <div>
              <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>{t('crafting2x2')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(2, ${SLOT_SIZE}px)`,
                  gap: '2px',
                }}>
                  {craftingGrid.map((id, i) => {
                    const item = id !== 0 ? { id, count: 1 } : null;
                    return renderSlot(item, i, () => handleSlotClick(i, true), false, undefined, 'crafting');
                  })}
                </div>
                <div style={{ fontSize: '20px', color: '#aaa' }}>→</div>
                {renderSlot(craftResult, -1, handleCraftResultClick, true, undefined, 'crafting')}
              </div>
            </div>
          )}
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
            {hoveredSlot.item.customName || (hoveredSlot.item.potion?.name ? getLocalizedDisplayName(hoveredSlot.item.potion.name) : getLocalizedItemName(hoveredSlot.item.id, hoveredSlot.itemDef.displayName))}
          </span>
          <span style={{ color: '#888888', fontSize: '10px', textTransform: 'capitalize' }}>
            {getLocalizedCategory(hoveredSlot.itemDef.category)}
          </span>
          {hoveredSlot.item.enchantments?.map((enchantment) => (
            <span key={enchantment.id} style={{ color: '#aaaaff', fontSize: '10px' }}>
              {EnchantSystem.getDisplayName(enchantment)}
            </span>
          ))}
          {hoveredSlot.item.potion?.effect && (
            <span style={{ color: '#aaaaff', fontSize: '10px' }}>
              {PotionEffects.format(hoveredSlot.item.potion.effect)}
              {hoveredSlot.item.potion.effect.duration > 0 ? ` ${Math.ceil(hoveredSlot.item.potion.effect.duration)}s` : ''}
            </span>
          )}
          {hoveredSlot.item.durability !== undefined && hoveredSlot.itemDef.durability && (
            <span style={{ color: '#55FF55', fontSize: '10px' }}>
              {t('durability', { current: hoveredSlot.item.durability, max: hoveredSlot.itemDef.durability })}
            </span>
          )}
        </div>
      )}
    </div>
    </div>
  );
};
