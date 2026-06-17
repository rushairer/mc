import React from 'react';
import type { GameState } from '../engine/Game';

export const DebugOverlay: React.FC<{ state: GameState; visible: boolean }> = ({ state, visible }) => {
  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      left: 8,
      color: '#fff',
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      lineHeight: '1.5',
      textShadow: '1px 1px 0 #000',
      pointerEvents: 'none',
      background: 'rgba(0,0,0,0.4)',
      padding: '8px 12px',
      borderRadius: '4px',
    }}>
      <div style={{ color: '#4f4' }}>Minecraft Clone v0.1</div>
      <div>{state.fps} fps</div>
      <div>&nbsp;</div>
      <div>XYZ: {state.playerX} / {state.playerY} / {state.playerZ}</div>
      <div>Biome: {state.biome}</div>
      <div>Chunks: {state.chunkCount}</div>
      <div>Mobs: {state.mobCount}</div>
      <div>Time: {state.isNight ? 'Night' : 'Day'}</div>
      <div>Block: {state.selectedBlock}</div>
      <div>Mode: <span style={{ textTransform: 'capitalize' }}>{state.gameMode}</span></div>
      <div>Slot: {state.selectedSlot + 1}/9</div>
      <div>&nbsp;</div>
      <div>Ground: {state.onGround ? 'yes' : 'no'}</div>
      <div>Flying: {state.flying ? 'yes' : 'no'}</div>
      <div>&nbsp;</div>
      <div style={{ color: '#aaa', fontSize: '10px' }}>F3: Debug | F: Fly | LMB: Break | RMB: Place</div>
    </div>
  );
};
