import React from 'react';
import { ADVANCEMENTS, Advancement } from '../systems/AdvancementSystem';

interface AdvancementsUIProps {
  unlockedList: string[];
  onClose: () => void;
  getItemIconStyle: (itemId: number, size?: number) => React.CSSProperties;
}

export const AdvancementsUI: React.FC<AdvancementsUIProps> = ({
  unlockedList,
  onClose,
  getItemIconStyle,
}) => {
  const isUnlocked = (id: string) => unlockedList.includes(id);

  // Group achievements into columns for progression flow:
  // Col 1: Gathering (Getting Wood)
  // Col 2: Basic Tools & Life (Stone Age, Sweet Dreams)
  // Col 3: Materials & Magic (Acquire Hardware, Enchanter)
  // Col 4: Dimensions & Brewing (Local Brewery, Into Nether)
  // Col 5: Bosses & Gateways (Into End, The Beginning)
  // Col 6: Final Boss (Free the End)

  const columns: { title: string; items: Advancement[] }[] = [
    {
      title: 'Roots',
      items: [ADVANCEMENTS.getting_wood],
    },
    {
      title: 'Tools & Sleep',
      items: [ADVANCEMENTS.stone_age, ADVANCEMENTS.sweet_dreams],
    },
    {
      title: 'Upgrades',
      items: [ADVANCEMENTS.acquire_hardware, ADVANCEMENTS.enchanter],
    },
    {
      title: 'Alchemy & Dimensions',
      items: [ADVANCEMENTS.brew_potion, ADVANCEMENTS.into_nether],
    },
    {
      title: 'Gateways',
      items: [ADVANCEMENTS.into_end, ADVANCEMENTS.kill_wither],
    },
    {
      title: 'Free the End',
      items: [ADVANCEMENTS.kill_dragon],
    },
  ];

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: 'monospace',
    }}>
      <div style={{
        width: '85%',
        maxWidth: '900px',
        height: '75%',
        maxHeight: '600px',
        background: '#2c2c2c',
        border: '4px solid #141414',
        boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '6px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Title Bar */}
        <div style={{
          background: '#1a1a1a',
          padding: '15px 20px',
          borderBottom: '3px solid #141414',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{
            margin: 0,
            color: '#ffaa00',
            fontSize: '20px',
            textShadow: '2px 2px 0px #000000',
            fontWeight: 'bold',
          }}>
            ADVANCEMENTS ({unlockedList.length} / {Object.keys(ADVANCEMENTS).length})
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: '#5c5c5c',
              border: '2px solid #000',
              borderTopColor: '#8c8c8c',
              borderLeftColor: '#8c8c8c',
              color: '#fff',
              padding: '6px 14px',
              cursor: 'pointer',
              fontWeight: 'bold',
              textShadow: '1px 1px 0px #000',
              boxShadow: '0 2px 0 #1b1b1b',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#90b0ff';
              e.currentTarget.style.borderColor = '#2b457e';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#5c5c5c';
              e.currentTarget.style.borderColor = '#000';
            }}
          >
            Close
          </button>
        </div>

        {/* Board content */}
        <div style={{
          flex: 1,
          padding: '25px',
          overflowY: 'auto',
          display: 'flex',
          gap: '20px',
          background: '#1d1d1d',
          backgroundImage: 'radial-gradient(#252525 20%, transparent 20%)',
          backgroundSize: '16px 16px',
        }}>
          {columns.map((col, cIdx) => (
            <div 
              key={cIdx} 
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                minWidth: '130px',
                flex: 1,
              }}
            >
              <div style={{
                color: '#aaaaaa',
                fontSize: '11px',
                textAlign: 'center',
                borderBottom: '2px solid #333',
                paddingBottom: '5px',
                fontWeight: 'bold',
              }}>
                {col.title}
              </div>

              {col.items.map((item) => {
                const unlocked = isUnlocked(item.id);
                return (
                  <div 
                    key={item.id}
                    style={{
                      background: unlocked ? 'rgba(79, 172, 254, 0.15)' : 'rgba(50, 50, 50, 0.4)',
                      border: unlocked ? '2px solid #5ca4ff' : '2px solid #444',
                      borderRadius: '5px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      position: 'relative',
                      boxShadow: unlocked ? '0 0 10px rgba(92,164,255,0.3)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Icon */}
                    <div 
                      style={{
                        ...getItemIconStyle(item.icon, 32),
                        opacity: unlocked ? 1.0 : 0.25,
                        marginBottom: '8px',
                      }} 
                    />

                    {/* Title */}
                    <div style={{
                      color: unlocked ? '#ffaa00' : '#888',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      textAlign: 'center',
                      textShadow: unlocked ? '1px 1px 0px #000' : 'none',
                    }}>
                      {item.title}
                    </div>

                    {/* Description */}
                    <div style={{
                      color: unlocked ? '#ccc' : '#555',
                      fontSize: '10px',
                      textAlign: 'center',
                      marginTop: '4px',
                      lineHeight: '1.2',
                    }}>
                      {item.description}
                    </div>

                    {/* Status Badge */}
                    <div style={{
                      marginTop: '8px',
                      fontSize: '9px',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: unlocked ? '#4f4' : '#666',
                      color: unlocked ? '#000' : '#ccc',
                      fontWeight: 'bold',
                    }}>
                      {unlocked ? 'COMPLETED' : 'LOCKED'}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom instructions */}
        <div style={{
          background: '#161616',
          padding: '10px 20px',
          color: '#888',
          fontSize: '11px',
          textAlign: 'center',
          borderTop: '2px solid #141414',
        }}>
          Tip: Complete achievements in-game to unlock their steps! Press 'L' to exit.
        </div>
      </div>
    </div>
  );
};
