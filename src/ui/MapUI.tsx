import React from 'react';
import type { ItemStack } from '../types';

interface MapUIProps {
  item: ItemStack;
  onClose: () => void;
}

export const MapUI: React.FC<MapUIProps> = ({ item, onClose }) => {
  const map = item.map;
  if (!map) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 260,
        fontFamily: '"Courier New", monospace',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          background: '#d7c38f',
          border: '8px solid #8b6f3c',
          boxShadow: '0 16px 32px rgba(0,0,0,0.55), inset 0 0 0 4px #ead9a6',
          padding: '22px',
          width: 'min(78vw, 520px)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(32, 1fr)',
            aspectRatio: '1 / 1',
            border: '3px solid #624b2a',
            background: '#bfa66d',
          }}
        >
          {map.pixels.map((color, index) => {
            const px = index % 32;
            const py = Math.floor(index / 32);
            const isPlayer = Math.abs(px - map.playerMarker.x) <= 1 && Math.abs(py - map.playerMarker.z) <= 1;
            return (
              <div
                key={index}
                style={{
                  background: isPlayer ? '#f7f2e0' : color,
                  boxShadow: isPlayer ? 'inset 0 0 0 1px #9b1f1f' : undefined,
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            color: '#2b2114',
            fontSize: '13px',
            fontWeight: 'bold',
            marginTop: '14px',
          }}
        >
          <span>Map #{map.id}</span>
          <span>X {map.centerX} Z {map.centerZ}</span>
          <span>Scale 1:{map.scale}</span>
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: '18px',
            width: '100%',
            padding: '10px 16px',
            background: '#5c5c5c',
            border: '3px solid #000',
            borderTopColor: '#8c8c8c',
            borderLeftColor: '#8c8c8c',
            color: '#e0e0e0',
            fontFamily: '"Courier New", monospace',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer',
            textShadow: '2px 2px 0 #000',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
};
