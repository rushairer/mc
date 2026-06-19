import React from 'react';
import type { GameState } from '../engine/Game';
import { useI18n } from '../i18n';
import { ItemRegistry } from '../items/ItemRegistry';

export const DebugOverlay: React.FC<{ state: GameState; visible: boolean }> = ({ state, visible }) => {
  const { t, getLocalizedBiomeName, getLocalizedItemName } = useI18n();

  if (!visible) return null;

  const timeStr = state.isNight ? t('night') : t('day');
  const groundStr = state.onGround ? t('yes') : t('no');
  const flyingStr = state.flying ? t('yes') : t('no');
  const modeStr = state.gameMode === 'creative' ? t('creativeMode') : t('survivalMode');
  const selectedDef = state.heldItemId ? ItemRegistry.get(state.heldItemId) : null;
  const selectedBlock = selectedDef
    ? getLocalizedItemName(state.heldItemId, selectedDef.displayName)
    : state.selectedBlock;
  const dimensionName = state.currentDimension === 2
    ? 'End'
    : state.currentDimension === 1
      ? 'Nether'
      : 'Overworld';

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
      <div>{t('fps', { fps: state.fps })}</div>
      <div>&nbsp;</div>
      <div>{t('xyz', { x: state.playerX, y: state.playerY, z: state.playerZ })}</div>
      <div>{t('biome', { biome: getLocalizedBiomeName(state.biome) })}</div>
      <div>Dimension: {dimensionName}</div>
      <div>{t('chunks', { chunks: state.chunkCount })}</div>
      <div>{t('mobs', { mobs: state.mobCount })}</div>
      <div>{t('time', { time: timeStr })}</div>
      <div>{t('block', { block: selectedBlock })}</div>
      <div>{t('mode', { mode: modeStr })}</div>
      <div>{t('slot', { slot: state.selectedSlot + 1 })}</div>
      <div>&nbsp;</div>
      <div>{t('ground', { ground: groundStr })}</div>
      <div>{t('flying', { flying: flyingStr })}</div>
      <div>&nbsp;</div>
      <div style={{ color: '#aaa', fontSize: '10px' }}>{t('debugFooter')}</div>
    </div>
  );
};
