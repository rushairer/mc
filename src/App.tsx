import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Game, GameState, type UIType } from './engine/Game';
import { HUD } from './ui/HUD';
import { DebugOverlay } from './ui/DebugOverlay';
import { InventoryUI } from './ui/InventoryUI';
import { FurnaceUI } from './ui/FurnaceUI';
import { CraftingTableUI } from './ui/CraftingTableUI';
import { ChestUI } from './ui/ChestUI';

const initialGameState: GameState = {
  fps: 0,
  playerX: 0,
  playerY: 0,
  playerZ: 0,
  biome: 'Unknown',
  chunkCount: 0,
  mobCount: 0,
  selectedBlock: 'empty',
  selectedSlot: 0,
  health: 20,
  hunger: 20,
  oxygen: 15.0,
  onGround: false,
  flying: false,
  openUI: 'none',
  inventory: null as any,
  chestInventory: null,
  heldItemId: 0,
  isNight: false,
  isUnderwater: false,
};

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [showDebug, setShowDebug] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = new Game(containerRef.current);
    gameRef.current = game;

    game.onStateChange((state) => {
      setGameState(state);
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setShowDebug((v) => !v);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      game.dispose();
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleCloseUI = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.closeUI();
    }
  }, []);

  const handleRespawn = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.respawn();
    }
  }, []);

  const handleInventoryChange = useCallback(() => {
    // Force re-render by notifying state
    if (gameRef.current) {
      gameRef.current['notifyState']();
    }
  }, []);

  const dismissInstructions = useCallback(() => {
    setShowInstructions(false);
  }, []);

  const getItemIconStyle = useCallback((itemId: number, size?: number) => {
    if (gameRef.current) {
      return gameRef.current.getItemIconStyle(itemId, size);
    }
    return {};
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Underwater blue screen tint */}
      {gameState.openUI === 'none' && gameState.isUnderwater && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(63, 118, 228, 0.18)',
          pointerEvents: 'none',
          zIndex: 10,
        }} />
      )}

      <HUD state={gameState} getItemIconStyle={getItemIconStyle} />
      <DebugOverlay state={gameState} visible={showDebug} />

      {/* Crosshair (only when no UI open) */}
      {gameState.openUI === 'none' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '2px',
            height: '20px',
            background: 'rgba(255,255,255,0.8)',
            position: 'absolute',
            top: '-10px',
            left: '-1px',
          }} />
          <div style={{
            width: '20px',
            height: '2px',
            background: 'rgba(255,255,255,0.8)',
            position: 'absolute',
            top: '-1px',
            left: '-10px',
          }} />
        </div>
      )}

      {/* Inventory UI */}
      {gameState.openUI === 'inventory' && gameState.inventory && (
        <InventoryUI
          inventory={gameState.inventory}
          onClose={handleCloseUI}
          onInventoryChange={handleInventoryChange}
          getItemIconStyle={getItemIconStyle}
        />
      )}

      {/* Furnace UI */}
      {gameState.openUI === 'furnace' && gameState.inventory && (
        <FurnaceUI
          inventory={gameState.inventory}
          onClose={handleCloseUI}
          onInventoryChange={handleInventoryChange}
          getItemIconStyle={getItemIconStyle}
        />
      )}

      {/* Crafting Table UI */}
      {gameState.openUI === 'crafting_table' && gameState.inventory && (
        <CraftingTableUI
          inventory={gameState.inventory}
          onClose={handleCloseUI}
          onInventoryChange={handleInventoryChange}
          getItemIconStyle={getItemIconStyle}
        />
      )}

      {/* Chest UI */}
      {gameState.openUI === 'chest' && gameState.inventory && gameState.chestInventory && (
        <ChestUI
          inventory={gameState.inventory}
          chestSlots={gameState.chestInventory}
          onClose={handleCloseUI}
          onInventoryChange={handleInventoryChange}
          getItemIconStyle={getItemIconStyle}
        />
      )}

      {/* Death UI */}
      {gameState.openUI === 'death' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(120, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
        }}>
          <h1 style={{
            color: '#f33',
            fontSize: '48px',
            fontFamily: '"Courier New", monospace',
            textShadow: '3px 3px 0 #000',
            marginBottom: '24px',
          }}>
            You died!
          </h1>
          <button
            onClick={handleRespawn}
            style={{
              padding: '12px 24px',
              fontSize: '18px',
              fontFamily: '"Courier New", monospace',
              background: '#333',
              color: '#fff',
              border: '2px solid #555',
              cursor: 'pointer',
              textShadow: '1px 1px 0 #000',
              boxShadow: '2px 2px 0 #000',
            }}
          >
            Respawn
          </button>
        </div>
      )}

      {/* Break progress indicator */}
      {gameState.openUI === 'none' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          marginTop: '20px',
        }}>
          {/* The break progress is shown via block highlight, no extra UI needed */}
        </div>
      )}

      {/* Instructions overlay */}
      {showInstructions && (
        <div
          onClick={dismissInstructions}
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
            cursor: 'pointer',
            zIndex: 100,
          }}
        >
          <div style={{
            background: 'rgba(50,50,50,0.95)',
            border: '3px solid #555',
            borderRadius: '8px',
            padding: '32px 48px',
            color: '#fff',
            fontFamily: '"Courier New", monospace',
            textAlign: 'center',
          }}>
            <h2 style={{ marginBottom: '16px', fontSize: '24px', color: '#4f4' }}>
              Minecraft Clone
            </h2>
             <div style={{ lineHeight: '2', fontSize: '14px', textAlign: 'left' }}>
              <div><b>WASD</b> — Move</div>
              <div><b>Space</b> — Jump</div>
              <div><b>Shift</b> — Sprint</div>
              <div><b>F</b> — Toggle Fly</div>
              <div><b>Mouse</b> — Look around</div>
              <div><b>Left Click</b> — Break block / Attack mob (hold)</div>
              <div><b>Right Click</b> — Place block / Open container (Crafting Table, Furnace, Chest) / Eat food (hold)</div>
              <div><b>1-9</b> — Select hotbar slot</div>
              <div><b>E</b> — Inventory & Crafting</div>
              <div><b>F5</b> — Toggle perspective</div>
              <div><b>F3</b> — Toggle debug overlay</div>
            </div>
            <div style={{ marginTop: '12px', color: '#ffaa00', fontSize: '12px', textAlign: 'left', fontStyle: 'italic' }}>
              * Tip: Hold Right Click while holding food to eat and fill hunger. Health regenerates naturally when hunger is &gt;= 18.
            </div>
            <div style={{ marginTop: '12px', color: '#8f8', fontSize: '12px' }}>
              Auto-saves every 60 seconds
            </div>
            <div style={{ marginTop: '8px', color: '#aaa', fontSize: '12px' }}>
              Click anywhere to start
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
