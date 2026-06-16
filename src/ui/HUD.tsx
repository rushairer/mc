import React from 'react';
import type { GameState } from '../engine/Game';
import { ItemRegistry } from '../items/ItemRegistry';

export const HUD: React.FC<{ state: GameState }> = ({ state }) => {
  // Health hearts
  const hearts = Array.from({ length: 10 }, (_, i) => {
    const filled = state.health >= (i + 1) * 2;
    const half = state.health >= i * 2 + 1 && state.health < (i + 1) * 2;
    return (
      <span key={i} style={{
        color: filled ? '#e22' : half ? '#e64' : '#444',
        fontSize: '18px',
        textShadow: '1px 1px 0 #000',
      }}>
        {filled ? '❤' : half ? '💔' : '🖤'}
      </span>
    );
  });

  // Hunger drumsticks
  const drumsticks = Array.from({ length: 10 }, (_, i) => {
    const filled = state.hunger >= (i + 1) * 2;
    return (
      <span key={i} style={{
        color: filled ? '#d80' : '#444',
        fontSize: '16px',
        textShadow: '1px 1px 0 #000',
      }}>
        🍗
      </span>
    );
  });

  // Get hotbar items from inventory
  const hotbarItems = state.inventory
    ? Array.from({ length: 9 }, (_, i) => state.inventory.getSlot(i))
    : [];

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      pointerEvents: 'none',
      fontFamily: '"Courier New", monospace',
    }}>
      {/* Health and Hunger bars */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 20px',
        marginBottom: '4px',
      }}>
        <div style={{ display: 'flex', gap: '1px' }}>{hearts}</div>
        <div style={{ display: 'flex', gap: '1px' }}>{drumsticks}</div>
      </div>

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
                  <span style={{ fontSize: '8px' }}>{itemDef.displayName}</span>
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
    </div>
  );
};
