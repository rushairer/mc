import React from 'react';
import type { GameState } from '../engine/Game';
import { ItemRegistry } from '../items/ItemRegistry';
import { useI18n } from '../i18n';
import { PotionEffects } from '../systems/PotionEffect';

export const HUD: React.FC<{ state: GameState, getItemIconStyle: (id: number, size?: number) => any }> = ({ state, getItemIconStyle }) => {
  const { getLocalizedItemName } = useI18n();
  // Health hearts
  const hearts = Array.from({ length: 10 }, (_, i) => {
    const filled = state.health >= (i + 1) * 2;
    const half = state.health >= i * 2 + 1 && state.health < (i + 1) * 2;
    return (
      <span key={i} style={{
        position: 'relative',
        display: 'inline-block',
        width: '18px',
        height: '18px',
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        lineHeight: '18px',
      }}>
        {/* Shadow layer */}
        <span style={{
          position: 'absolute',
          left: '1px',
          top: '1px',
          color: '#000',
          zIndex: 1,
        }}>
          ❤
        </span>
        {/* Color layer */}
        <span style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 2,
          ...(filled ? {
            color: '#ff2222'
          } : half ? {
            background: 'linear-gradient(90deg, #ff2222 50%, #444444 50%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          } : {
            color: '#444444'
          })
        }}>
          ❤
        </span>
      </span>
    );
  });

  // Hunger drumsticks
  const drumsticks = Array.from({ length: 10 }, (_, i) => {
    const filled = state.hunger >= (i + 1) * 2;
    const half = state.hunger >= i * 2 + 1 && state.hunger < (i + 1) * 2;
    return (
      <span key={i} style={{
        position: 'relative',
        display: 'inline-block',
        width: '16px',
        height: '16px',
        fontSize: '16px',
        textAlign: 'center',
        lineHeight: '16px',
      }}>
        {/* Shadow layer */}
        <span style={{
          position: 'absolute',
          left: '1px',
          top: '1px',
          filter: 'brightness(0) opacity(0.8)',
          zIndex: 1,
        }}>
          🍗
        </span>
        {/* Color/Image layer */}
        <span style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 2,
          filter: filled ? 'none' : half ? 'grayscale(50%) opacity(0.8)' : 'grayscale(100%) brightness(30%) opacity(0.5)'
        }}>
          🍗
        </span>
      </span>
    );
  });

  // Oxygen bubbles
  const showOxygen = state.oxygen < 15.0;
  const oxygenBubbles = showOxygen ? Array.from({ length: 10 }, (_, i) => {
    const filled = (state.oxygen / 15.0) * 10 > i;
    return (
      <span key={i} style={{
        fontSize: '16px',
        opacity: filled ? 1.0 : 0.2, // dim depleted bubbles
        transition: 'opacity 0.2s',
      }}>
        🫧
      </span>
    );
  }) : null;

  // Armor shields
  let totalArmorDefense = 0;
  if (state.inventory && Array.isArray(state.inventory.armor)) {
    for (const item of state.inventory.armor) {
      if (item) {
        const def = ItemRegistry.get(item.id);
        if (def && def.armorDefense !== undefined) {
          totalArmorDefense += def.armorDefense;
        }
      }
    }
  }
  const armorIcons = Array.from({ length: 10 }, (_, i) => {
    const filled = totalArmorDefense >= (i + 1) * 2;
    const half = totalArmorDefense >= i * 2 + 1 && totalArmorDefense < (i + 1) * 2;
    return (
      <span key={i} style={{
        position: 'relative',
        display: 'inline-block',
        width: '16px',
        height: '16px',
        fontSize: '14px',
        textAlign: 'center',
        lineHeight: '16px',
      }}>
        {/* Shadow layer */}
        <span style={{
          position: 'absolute',
          left: '1px',
          top: '1px',
          color: '#000',
          zIndex: 1,
          opacity: 0.8,
        }}>
          🛡️
        </span>
        {/* Color layer */}
        <span style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 2,
          ...(filled ? {
            color: '#55aaff'
          } : half ? {
            background: 'linear-gradient(90deg, #55aaff 50%, #444444 50%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          } : {
            color: 'rgba(68, 68, 68, 0.4)'
          })
        }}>
          🛡️
        </span>
      </span>
    );
  });

  // Hotbar item name popup state
  const [lastSelectedSlot, setLastSelectedSlot] = React.useState(state.selectedSlot);
  const [lastHeldId, setLastHeldId] = React.useState(state.heldItemId);
  const [showName, setShowName] = React.useState(false);
  const [fadeName, setFadeName] = React.useState('');

  // Get hotbar items from inventory
  const hotbarItems = state.inventory
    ? Array.from({ length: 9 }, (_, i) => state.inventory.getSlot(i))
    : [];

  React.useEffect(() => {
    if (state.selectedSlot !== lastSelectedSlot || state.heldItemId !== lastHeldId) {
      setLastSelectedSlot(state.selectedSlot);
      setLastHeldId(state.heldItemId);
      
      const item = hotbarItems[state.selectedSlot];
      if (item) {
        const itemDef = ItemRegistry.get(item.id);
        if (itemDef) {
          setFadeName(getLocalizedItemName(item.id, itemDef.displayName));
          setShowName(true);
        }
      } else {
        setShowName(false);
      }
    }
  }, [state.selectedSlot, state.heldItemId, lastSelectedSlot, lastHeldId, hotbarItems, getLocalizedItemName]);

  React.useEffect(() => {
    if (showName) {
      const timer = setTimeout(() => {
        setShowName(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showName, fadeName]);

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      pointerEvents: 'none',
      fontFamily: '"Courier New", monospace',
    }}>
      {state.bossName && state.bossMaxHealth > 0 && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '520px',
          maxWidth: 'calc(100vw - 48px)',
          textAlign: 'center',
        }}>
          <div style={{
            color: '#f4d8ff',
            fontSize: '15px',
            fontWeight: 'bold',
            textShadow: '2px 2px 0 #000',
            marginBottom: '4px',
          }}>
            {state.bossName}
          </div>
          <div style={{
            height: '14px',
            border: '2px solid #120012',
            background: '#1b061e',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 0 rgba(0,0,0,0.5)',
          }}>
            <div style={{
              width: `${Math.max(0, Math.min(1, state.bossHealth / state.bossMaxHealth)) * 100}%`,
              height: '100%',
              background: 'linear-gradient(180deg, #ff83ff 0%, #b116d3 45%, #5d0075 100%)',
              boxShadow: '0 0 8px rgba(221, 70, 255, 0.75)',
            }} />
          </div>
        </div>
      )}

      {state.activePotionEffects.length > 0 && (
        <div style={{
          position: 'absolute',
          right: '16px',
          bottom: '126px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          alignItems: 'flex-end',
        }}>
          {state.activePotionEffects.map((effect) => (
            <div key={effect.id} style={{
              background: 'rgba(0,0,0,0.55)',
              color: '#d8c8ff',
              padding: '3px 6px',
              borderRadius: '2px',
              fontSize: '11px',
              textShadow: '1px 1px 0 #000',
            }}>
              {PotionEffects.format(effect)} {Math.ceil(effect.remaining)}s
            </div>
          ))}
        </div>
      )}

      {/* Health and Hunger bars */}
      {state.gameMode !== 'creative' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '0 20px',
          marginBottom: '4px',
        }}>
          {/* Armor shields and Oxygen bubbles layer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            height: '20px',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', gap: '1px' }}>
              {totalArmorDefense > 0 && armorIcons}
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              {showOxygen && oxygenBubbles}
            </div>
          </div>

          {/* Hearts and Drumsticks */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: '1px' }}>{hearts}</div>
            <div style={{ display: 'flex', gap: '1px' }}>{drumsticks}</div>
          </div>

          {/* XP bar */}
          <div style={{
            position: 'relative',
            height: '12px',
            margin: '1px auto 0',
            width: '432px',
            maxWidth: 'calc(100vw - 40px)',
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '4px',
              height: '5px',
              background: '#151515',
              border: '1px solid #050505',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
            }}>
              <div style={{
                width: `${Math.max(0, Math.min(1, state.xpProgress)) * 100}%`,
                height: '100%',
                background: 'linear-gradient(180deg, #dfff54 0%, #71d51f 45%, #2f8f0c 100%)',
                boxShadow: '0 0 4px rgba(150,255,45,0.75)',
              }} />
            </div>
            {state.xpLevel > 0 && (
              <div style={{
                position: 'absolute',
                left: '50%',
                bottom: '2px',
                transform: 'translateX(-50%)',
                color: '#7dff34',
                fontSize: '15px',
                fontWeight: 'bold',
                lineHeight: 1,
                textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 0 0 4px #000',
              }}>
                {state.xpLevel}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Item Name Pop-up */}
      {fadeName && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '8px',
          opacity: showName ? 1.0 : 0.0,
          transition: 'opacity 0.3s ease-in-out',
          textAlign: 'center',
        }}>
          <span style={{
            background: 'rgba(0,0,0,0.65)',
            color: '#ffffff',
            padding: '4px 8px',
            borderRadius: '2px',
            fontSize: '13px',
            textShadow: '1px 1px 0 #000',
            fontWeight: 'bold',
          }}>
            {fadeName}
          </span>
        </div>
      )}

      {/* Hotbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '2px',
        padding: '4px',
        background: 'rgba(0,0,0,0.5)',
      }}>
        {Array.from({ length: 9 }, (_, i) => {
          const item = hotbarItems[i];
          const itemDef = item ? ItemRegistry.get(item.id) : null;
          return (
            <div key={i} style={{
              width: '48px',
              height: '48px',
              border: i === state.selectedSlot
                ? '3px solid #fff'
                : '2px solid #555',
              background: 'rgba(80,80,80,0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              color: '#fff',
              textShadow: '1px 1px 0 #000',
              position: 'relative',
            }}>
              {itemDef ? (
                <>
                  <div style={getItemIconStyle(item!.id, 32)} title={getLocalizedItemName(item!.id, itemDef.displayName)} />
                  {item!.count > 1 && (
                    <span style={{
                      position: 'absolute',
                      bottom: '1px',
                      right: '3px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}>
                      {item!.count}
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
              ) : null}
              <span style={{
                position: 'absolute',
                top: '1px',
                right: '3px',
                fontSize: '8px',
                color: '#aaa',
              }}>{i + 1}</span>
            </div>
          );
        })}
      </div>

      {/* Looked At Sign Text Overlay */}
      {state.lookedAtSignText && (
        <div style={{
          position: 'absolute',
          bottom: '150px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '200px',
          background: '#a07040',
          border: '3px solid #604020',
          borderRadius: '4px',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          zIndex: 100,
        }}>
          {state.lookedAtSignText.map((line, idx) => (
            <div
              key={idx}
              style={{
                color: '#000',
                fontSize: '14px',
                fontFamily: '"Courier New", monospace',
                fontWeight: 'bold',
                textAlign: 'center',
                whiteSpace: 'pre',
                minHeight: '16px',
                width: '100%',
              }}
            >
              {line || ' '}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
