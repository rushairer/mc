import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Game, GameState, type UIType } from './engine/Game';
import { HUD } from './ui/HUD';
import { DebugOverlay } from './ui/DebugOverlay';
import { InventoryUI } from './ui/InventoryUI';
import { ChatBar } from './ui/ChatBar';
import { FurnaceUI } from './ui/FurnaceUI';
import { CraftingTableUI } from './ui/CraftingTableUI';
import { ChestUI } from './ui/ChestUI';
import { SaveSystem } from './systems/SaveSystem';
import { useI18n, translations } from './i18n';

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
  gameMode: 'survival',
  activeSlot: 'world_1',
  chatOpen: false,
  chatInitialValue: '',
  chatMessages: [],
};

export const App: React.FC = () => {
  const { locale, setLocale, t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [showDebug, setShowDebug] = useState(true);
  const [menuState, setMenuState] = useState<'welcome' | 'controls' | 'select_world' | 'select_mode' | 'none'>('welcome');
  const [selectedMode, setSelectedMode] = useState<'survival' | 'creative'>('survival');
  const [selectedSlot, setSelectedSlot] = useState<string>('world_1');
  const [splashText, setSplashText] = useState('Also try Terraria!');
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [loadingWorld, setLoadingWorld] = useState(false);
  const [worldSaves, setWorldSaves] = useState<{
    [key: string]: { hasSave: boolean; mode?: 'survival' | 'creative'; pos?: string }
  }>({
    world_1: { hasSave: false },
    world_2: { hasSave: false },
    world_3: { hasSave: false },
  });

  const loadWorldSaves = useCallback(async () => {
    const slots = ['world_1', 'world_2', 'world_3'];
    const savesInfo: typeof worldSaves = {};
    for (const slot of slots) {
      const hasS = await SaveSystem.hasSave(slot);
      if (hasS) {
        const data = await SaveSystem.load(slot);
        if (data) {
          savesInfo[slot] = {
            hasSave: true,
            mode: data.player.gameMode || 'survival',
            pos: `X:${Math.round(data.player.x)} Y:${Math.round(data.player.y)} Z:${Math.round(data.player.z)}`,
          };
        } else {
          savesInfo[slot] = { hasSave: false };
        }
      } else {
        savesInfo[slot] = { hasSave: false };
      }
    }
    setWorldSaves(savesInfo);
  }, []);

  useEffect(() => {
    if (menuState === 'select_world') {
      loadWorldSaves();
    }
  }, [menuState, loadWorldSaves]);

  useEffect(() => {
    const list = translations[locale].splashTexts;
    const randomSplash = list[Math.floor(Math.random() * list.length)];
    setSplashText(randomSplash);
  }, [locale]);

  useEffect(() => {
    let game: Game | null = null;
    if (containerRef.current) {
      game = new Game(containerRef.current, undefined, 'world_1');
      gameRef.current = game;
      game.onStateChange((state) => {
        setGameState(state);
      });
      setMenuState('welcome');
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setShowDebug((v) => !v);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      if (game) game.dispose();
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

  const handleDropItem = useCallback((itemId: number, count: number) => {
    if (gameRef.current) {
      gameRef.current.dropItemFromUI(itemId, count);
    }
  }, []);

  const handleSingleplayerClick = useCallback(() => {
    setMenuState('select_world');
  }, []);

  const handleContinueWorld = useCallback(() => {
    if (gameRef.current) {
      // Continue the saved world using its saved mode
      gameRef.current.startGame(gameState.gameMode);
      setMenuState('none');
    }
  }, [gameState.gameMode]);

  const handleCreateNewWorldClick = useCallback(() => {
    setMenuState('select_mode');
  }, []);

  const handleLaunchWorld = useCallback(async () => {
    setLoadingWorld(true);
    // Yield a frame for React to render the loading screen
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Delete old save in this slot
    await SaveSystem.deleteSave(selectedSlot);

    if (gameRef.current) {
      gameRef.current.dispose();
    }

    if (containerRef.current) {
      const game = new Game(containerRef.current, selectedMode, selectedSlot);
      gameRef.current = game;
      game.onStateChange((state) => {
        setGameState(state);
      });
      
      // Enforce a minimum display time for the load screen
      await new Promise((resolve) => setTimeout(resolve, 800));

      game.startGame(selectedMode);
      setMenuState('none');
      setLoadingWorld(false);

      // Request pointer lock after React has painted the frame
      requestAnimationFrame(() => {
        game.requestPointerLock();
      });
    }
  }, [selectedMode, selectedSlot]);

  const handleResumeGame = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.resumeGame();
    }
  }, []);

  const handleSaveGame = useCallback(async () => {
    if (gameRef.current) {
      const success = await gameRef.current.manualSave();
      if (success) {
        setSaveFeedback(true);
        setTimeout(() => setSaveFeedback(false), 2000);
      }
    }
  }, []);

  const handleSaveAndQuit = useCallback(async () => {
    if (gameRef.current) {
      await gameRef.current.manualSave();
      setMenuState('welcome');
      gameRef.current.openUI = 'menu';
      document.exitPointerLock();
    }
  }, []);

  const getItemIconStyle = useCallback((itemId: number, size?: number) => {
    if (gameRef.current) {
      return gameRef.current.getItemIconStyle(itemId, size);
    }
    return {};
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Keyframe & Class Style Injection */}
      <style>{`
        @keyframes splashBounce {
          0% { transform: scale(1) rotate(-15deg); }
          100% { transform: scale(1.1) rotate(-15deg); }
        }
        @keyframes loadProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .minecraft-btn {
          width: 320px;
          padding: 12px;
          margin: 6px 0;
          background: #5c5c5c;
          border: 3px solid #000;
          border-top-color: #8c8c8c;
          border-left-color: #8c8c8c;
          color: #e0e0e0;
          font-family: "Courier New", monospace;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          text-align: center;
          text-shadow: 2px 2px 0 #000;
          box-shadow: 0 4px 0 #1b1b1b;
          box-sizing: border-box;
          transition: all 0.1s;
        }
        .minecraft-btn:hover {
          background: #90b0ff;
          border-color: #2b457e;
          border-top-color: #c0d0ff;
          border-left-color: #c0d0ff;
          color: #ffffff;
        }
        .minecraft-btn:active {
          transform: translateY(2px);
          box-shadow: 0 2px 0 #1b1b1b;
        }
        .mode-card {
          flex: 1;
          padding: 18px;
          border: 3px solid #333;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.45);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flexDirection: column;
          gap: 8px;
        }
        .mode-card:hover {
          border-color: #ffaa00;
          background: rgba(255, 255, 255, 0.05);
        }
        .mode-card.selected {
          border-color: #4f4;
          background: rgba(79, 244, 79, 0.08);
        }
      `}</style>

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
      <ChatBar
        open={gameState.chatOpen}
        messages={gameState.chatMessages}
        initialValue={gameState.chatInitialValue}
        onSubmit={(msg) => gameRef.current?.submitChat(msg)}
      />

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
          gameMode={gameState.gameMode}
          onDropItem={handleDropItem}
        />
      )}

      {/* Furnace UI */}
      {gameState.openUI === 'furnace' && gameState.inventory && (
        <FurnaceUI
          inventory={gameState.inventory}
          onClose={handleCloseUI}
          onInventoryChange={handleInventoryChange}
          getItemIconStyle={getItemIconStyle}
          onDropItem={handleDropItem}
        />
      )}

      {/* Crafting Table UI */}
      {gameState.openUI === 'crafting_table' && gameState.inventory && (
        <CraftingTableUI
          inventory={gameState.inventory}
          onClose={handleCloseUI}
          onInventoryChange={handleInventoryChange}
          getItemIconStyle={getItemIconStyle}
          onDropItem={handleDropItem}
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
          onDropItem={handleDropItem}
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
            {t('youDied')}
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
            {t('respawn')}
          </button>
        </div>
      )}

      {/* Pause Menu UI */}
      {gameState.openUI === 'pause' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 300,
          fontFamily: '"Courier New", monospace',
          userSelect: 'none',
        }}>
          <h2 style={{
            color: '#fff',
            fontSize: '28px',
            marginBottom: '4px',
            textShadow: '2px 2px 0 #000',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            {t('gameMenu')}
          </h2>
          <div style={{
            color: '#ffaa00',
            fontSize: '14px',
            marginBottom: '32px',
            textShadow: '1px 1px 0 #000',
            textTransform: 'uppercase',
            fontWeight: 'bold',
          }}>
            {t('worldSlot', { num: gameState.activeSlot ? gameState.activeSlot.split('_')[1] : '1' })} — {gameState.gameMode === 'creative' ? t('creativeMode') : t('survivalMode')}
          </div>

          <button className="minecraft-btn" onClick={handleResumeGame}>
            {t('backToGame')}
          </button>

          <button className="minecraft-btn" onClick={handleSaveGame}>
            {t('saveGame')}
          </button>

          <button className="minecraft-btn" style={{ background: '#7a2d2d', borderTopColor: '#b05050', borderLeftColor: '#b05050' }} onClick={handleSaveAndQuit}>
            {t('saveAndQuit')}
          </button>

          {saveFeedback && (
            <div style={{
              marginTop: '16px',
              color: '#4f4',
              fontSize: '14px',
              fontWeight: 'bold',
              textShadow: '1px 1px 0 #000',
              animation: 'splashBounce 0.2s alternate infinite ease-in-out',
            }}>
              {t('gameSaved')}
            </div>
          )}
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

      {/* Welcome Screen & Menus */}
      {menuState !== 'none' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle, #3a2512 0%, #170e06 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 500,
          fontFamily: '"Courier New", monospace',
          userSelect: 'none',
        }}>


          {/* WELCOME MAIN MENU */}
          {menuState === 'welcome' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Title Logo */}
              <div style={{ position: 'relative', marginBottom: '40px', textAlign: 'center' }}>
                <h1 style={{
                  fontSize: '44px',
                  fontWeight: 900,
                  margin: 0,
                  color: '#c4ab80',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  textShadow: '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 5px 5px 0 #2a1b10, 7px 7px 0 #2a1b10',
                }}>
                  Minecraft Clone
                </h1>
                {/* Yellow splash */}
                <div style={{
                  position: 'absolute',
                  right: '-60px',
                  bottom: '-24px',
                  color: '#ffff22',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  textShadow: '2px 2px 0 #000',
                  animation: 'splashBounce 0.4s infinite alternate ease-in-out',
                  whiteSpace: 'nowrap',
                }}>
                  {splashText}
                </div>
              </div>

              {/* Action Buttons */}
              <button className="minecraft-btn" onClick={handleSingleplayerClick}>
                {t('singleplayer')}
              </button>

              <button className="minecraft-btn" onClick={() => setMenuState('controls')}>
                {t('controlsInstructions')}
              </button>

              {/* Language Selector Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '12px' }}>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as any)}
                  className="minecraft-btn"
                  style={{
                    width: '320px',
                    textAlignLast: 'center',
                    background: '#5c5c5c',
                    color: '#e0e0e0',
                    border: '3px solid #000',
                    borderTopColor: '#8c8c8c',
                    borderLeftColor: '#8c8c8c',
                    fontFamily: '"Courier New", monospace',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textShadow: '2px 2px 0 #000',
                    boxShadow: '0 4px 0 #1b1b1b',
                    appearance: 'none',
                    outline: 'none',
                  }}
                >
                  <option value="en" style={{ background: '#333', color: '#fff' }}>Language: English</option>
                  <option value="zh-CN" style={{ background: '#333', color: '#fff' }}>语言：简体中文</option>
                  <option value="zh-TW" style={{ background: '#333', color: '#fff' }}>語言：繁體中文</option>
                </select>
              </div>
            </div>
          )}

          {/* SELECT WORLD / CONTINUE MENU */}
          {menuState === 'select_world' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '560px' }}>
              <h2 style={{
                color: '#fff',
                fontSize: '24px',
                marginBottom: '20px',
                textShadow: '2px 2px 0 #000'
              }}>
                {t('selectWorld')}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginBottom: '24px' }}>
                {['world_1', 'world_2', 'world_3'].map((slot, index) => {
                  const save = worldSaves[slot];
                  const slotLabel = t('worldSlot', { num: index + 1 });
                  return (
                    <div
                      key={slot}
                      style={{
                        padding: '12px 18px',
                        background: 'rgba(0,0,0,0.6)',
                        border: '2px solid #555',
                        borderRadius: '4px',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffaa00' }}>
                          {slotLabel}
                        </div>
                        {save.hasSave ? (
                          <div style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>
                            {t('modeLabel', { mode: save.mode === 'creative' ? t('creativeMode') : t('survivalMode') })} | {t('posLabel', { pos: save.pos || '' })}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                            {t('emptyWorldSlot')}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {save.hasSave ? (
                          <>
                            <button
                              className="minecraft-btn"
                              style={{ width: '100px', padding: '6px', fontSize: '12px', margin: 0 }}
                              onClick={async () => {
                                setLoadingWorld(true);
                                // Yield a frame for React to render the loading screen
                                await new Promise((resolve) => setTimeout(resolve, 50));

                                if (gameRef.current) {
                                  gameRef.current.dispose();
                                }
                                if (containerRef.current) {
                                  const game = new Game(containerRef.current, undefined, slot);
                                  gameRef.current = game;
                                  game.onStateChange((state) => {
                                    setGameState(state);
                                  });
                                  
                                  // Load and enforce minimum display time
                                  await Promise.all([
                                    game.loadGame(),
                                    new Promise((resolve) => setTimeout(resolve, 800))
                                  ]);

                                  game.startGame();
                                  setMenuState('none');
                                  setLoadingWorld(false);

                                  // Request pointer lock after React has painted the frame
                                  // (the loading screen must be gone from the DOM first)
                                  requestAnimationFrame(() => {
                                    game.requestPointerLock();
                                  });
                                }
                              }}
                            >
                              {t('play')}
                            </button>
                            <button
                              className="minecraft-btn"
                              style={{ width: '100px', padding: '6px', fontSize: '12px', margin: 0, background: '#7a2d2d', borderTopColor: '#b05050', borderLeftColor: '#b05050' }}
                              onClick={async () => {
                                if (window.confirm(t('confirmDelete', { slot: slotLabel }))) {
                                  await SaveSystem.deleteSave(slot);
                                  loadWorldSaves();
                                }
                              }}
                            >
                              {t('delete')}
                            </button>
                          </>
                        ) : (
                          <button
                            className="minecraft-btn"
                            style={{ width: '150px', padding: '6px', fontSize: '12px', margin: 0, background: '#558855', borderTopColor: '#77aa77', borderLeftColor: '#77aa77' }}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setMenuState('select_mode');
                            }}
                          >
                            {t('createWorld')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="minecraft-btn" style={{ background: '#444' }} onClick={() => setMenuState('welcome')}>
                {t('cancel')}
              </button>
            </div>
          )}

          {/* CHOOSE GAME MODE MENU */}
          {menuState === 'select_mode' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '560px' }}>
              <h2 style={{
                color: '#fff',
                fontSize: '24px',
                marginBottom: '24px',
                textShadow: '2px 2px 0 #000'
              }}>
                {t('chooseGameMode')}
              </h2>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', width: '100%' }}>
                {/* Survival Card */}
                <div
                  className={`mode-card ${selectedMode === 'survival' ? 'selected' : ''}`}
                  onClick={() => setSelectedMode('survival')}
                >
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff4444', textShadow: '1px 1px 0 #000' }}>
                    {t('survivalMode')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.4' }}>
                    {t('survivalDesc')}
                  </div>
                </div>

                {/* Creative Card */}
                <div
                  className={`mode-card ${selectedMode === 'creative' ? 'selected' : ''}`}
                  onClick={() => setSelectedMode('creative')}
                >
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#44ff44', textShadow: '1px 1px 0 #000' }}>
                    {t('creativeMode')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.4' }}>
                    {t('creativeDesc')}
                  </div>
                </div>
              </div>

              <button className="minecraft-btn" onClick={handleLaunchWorld}>
                {t('createWorld')}
              </button>

              <button className="minecraft-btn" style={{ background: '#444' }} onClick={() => {
                setMenuState('select_world');
              }}>
                {t('cancel')}
              </button>
            </div>
          )}

          {/* CONTROLS & HOW TO PLAY MENU */}
          {menuState === 'controls' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '480px' }}>
              <h2 style={{
                color: '#fff',
                fontSize: '24px',
                marginBottom: '20px',
                textShadow: '2px 2px 0 #000'
              }}>
                {t('controlsTitle')}
              </h2>

              <div style={{
                width: '100%',
                maxHeight: '320px',
                overflowY: 'auto',
                background: 'rgba(0,0,0,0.6)',
                border: '2px solid #555',
                borderRadius: '4px',
                padding: '16px 24px',
                color: '#fff',
                fontSize: '13px',
                lineHeight: '1.8',
                marginBottom: '24px',
                textAlign: 'left',
              }}>
                <div><b>W / A / S / D</b> — {t('controlMove').split(' — ')[1]}</div>
                <div><b>Space</b> — {t('controlJump').split(' — ')[1]}</div>
                <div><b>Shift</b> — {t('controlSprint').split(' — ')[1]}</div>
                <div><b>F</b> — {t('controlFly').split(' — ')[1]}</div>
                <div><b>Mouse</b> — {t('controlLook').split(' — ')[1]}</div>
                <div><b>Left Click</b> — {t('controlBreak').split(' — ')[1]}</div>
                <div><b>Right Click</b> — {t('controlPlace').split(' — ')[1]}</div>
                <div><b>1-9</b> — {t('controlHotbar').split(' — ')[1]}</div>
                <div><b>E</b> — {t('controlInventory').split(' — ')[1]}</div>
                <div><b>F5</b> — {t('controlPerspective').split(' — ')[1]}</div>
                <div><b>F3</b> — {t('controlDebug').split(' — ')[1]}</div>
                <div style={{ marginTop: '12px', color: '#ffaa00', fontStyle: 'italic', fontSize: '11px' }}>
                  {t('controlTips')}
                </div>
              </div>

              <button className="minecraft-btn" onClick={() => setMenuState('welcome')}>
                {t('back')}
              </button>
            </div>
          )}
        </div>
      )}
      {/* Loading Screen Overlay */}
      {loadingWorld && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle, #3a2512 0%, #170e06 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          fontFamily: '"Courier New", monospace',
          userSelect: 'none',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{
              color: '#fff',
              fontSize: '28px',
              marginBottom: '8px',
              textShadow: '2px 2px 0 #000',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              {t('loadingWorld')}
            </h2>
            <div style={{
              color: '#ffaa00',
              fontSize: '14px',
              marginBottom: '32px',
              textShadow: '1px 1px 0 #000',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}>
              {t('buildingTerrain')}
            </div>
            {/* Progress bar wrapper */}
            <div style={{
              width: '320px',
              height: '16px',
              background: '#000',
              border: '2px solid #8c8c8c',
              padding: '2px',
              boxSizing: 'border-box',
            }}>
              <div style={{
                height: '100%',
                background: '#55ff55',
                width: '0%',
                animation: 'loadProgress 0.8s linear forwards',
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
