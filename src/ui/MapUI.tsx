import React from 'react';
import type { ItemStack } from '../types';

interface MapUIProps {
  item: ItemStack;
  onClose: () => void;
}

export const MapUI: React.FC<MapUIProps> = ({ item, onClose }) => {
  const map = item.map;
  if (!map) return null;

  const marker = map.playerMarker as typeof map.playerMarker & { rotation?: number };
  const markerLeft = `${(marker.x / 127) * 100}%`;
  const markerTop = `${(marker.z / 127) * 100}%`;
  const markerRotation = Number.isFinite(marker.rotation) ? marker.rotation! : 0;

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
            position: 'relative',
            aspectRatio: '1 / 1',
            border: '3px solid #624b2a',
            background: '#bfa66d',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(128, 1fr)',
              gridTemplateRows: 'repeat(128, 1fr)',
            }}
          >
            {map.pixels.map((color, index) => (
              <div key={index} style={{ background: color }} />
            ))}
          </div>
          <div
            aria-label={`Player facing ${Math.round(markerRotation)} degrees`}
            style={{
              position: 'absolute',
              left: markerLeft,
              top: markerTop,
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: '15px solid #f7f2e0',
              filter: 'drop-shadow(0 0 1px #9b1f1f)',
              transform: `translate(-50%, -50%) rotate(${markerRotation}deg)`,
              transformOrigin: '50% 65%',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />
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
          <span>Scale 1:{1 << Math.max(0, Math.min(4, Math.floor(map.scale)))}</span>
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
