import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Inventory } from '../player/Inventory';
import { ItemRegistry } from '../items/ItemRegistry';
import type { TradeOffer, VillagerProfession } from '../systems/VillageSystem';

interface TradingUIProps {
  inventory: Inventory;
  profession: VillagerProfession;
  offers: TradeOffer[];
  gameMode: 'survival' | 'creative';
  onClose: () => void;
  onTrade: (offer: TradeOffer) => boolean;
  onInventoryChange: () => void;
  getItemIconStyle: (id: number, size?: number) => any;
}

const PROFESSION_LABELS: Record<VillagerProfession, string> = {
  farmer: 'Farmer',
  librarian: 'Librarian',
  toolsmith: 'Toolsmith',
  cleric: 'Cleric',
};

const SLOT_SIZE = 46;

export const TradingUI: React.FC<TradingUIProps> = ({
  inventory,
  profession,
  offers,
  gameMode,
  onClose,
  onTrade,
  onInventoryChange,
  getItemIconStyle,
}) => {
  const [, forceRender] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' || e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const itemCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const slot of inventory.slots) {
      if (slot) counts.set(slot.id, (counts.get(slot.id) ?? 0) + slot.count);
    }
    return counts;
  }, [inventory, offers, message]);

  const handleTrade = useCallback((offer: TradeOffer) => {
    const success = onTrade(offer);
    if (success) {
      setMessage('Trade complete');
      forceRender(v => v + 1);
      onInventoryChange();
    } else {
      setMessage('Missing items or inventory space');
    }
  }, [onInventoryChange, onTrade]);

  const renderItem = (id: number, count: number, subdued = false) => {
    const name = ItemRegistry.getDisplayName(id);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: subdued ? 0.5 : 1 }}>
        <div style={{
          width: `${SLOT_SIZE}px`,
          height: `${SLOT_SIZE}px`,
          background: '#8b8b8b',
          borderTop: '3px solid #373737',
          borderLeft: '3px solid #373737',
          borderBottom: '3px solid #ffffff',
          borderRight: '3px solid #ffffff',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={getItemIconStyle(id, 30)} />
          <span style={{
            position: 'absolute',
            right: '3px',
            bottom: '1px',
            color: 'white',
            fontSize: '13px',
            textShadow: '2px 2px #000',
            fontFamily: 'monospace',
          }}>{count}</span>
        </div>
        <span style={{ color: '#2b2b2b', fontSize: '15px' }}>{name}</span>
      </div>
    );
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      fontFamily: 'monospace',
    }}>
      <div style={{
        width: 'min(720px, calc(100vw - 32px))',
        background: '#c6c6c6',
        borderTop: '4px solid #ffffff',
        borderLeft: '4px solid #ffffff',
        borderBottom: '4px solid #373737',
        borderRight: '4px solid #373737',
        padding: '18px',
        color: '#2b2b2b',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{PROFESSION_LABELS[profession]}</div>
            <div style={{ fontSize: '13px', color: '#555' }}>Villager Trading</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '34px',
              height: '34px',
              background: '#8b8b8b',
              borderTop: '3px solid #ffffff',
              borderLeft: '3px solid #ffffff',
              borderBottom: '3px solid #373737',
              borderRight: '3px solid #373737',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            X
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {offers.map((offer) => {
            const owned = itemCounts.get(offer.input.id) ?? 0;
            const canTrade = gameMode === 'creative' || owned >= offer.input.count;
            return (
              <div key={offer.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 42px 1fr 118px',
                alignItems: 'center',
                gap: '12px',
                background: canTrade ? '#d8d8d8' : '#b5b5b5',
                borderTop: '3px solid #ffffff',
                borderLeft: '3px solid #ffffff',
                borderBottom: '3px solid #6a6a6a',
                borderRight: '3px solid #6a6a6a',
                padding: '10px',
              }}>
                {renderItem(offer.input.id, offer.input.count, !canTrade)}
                <div style={{ fontSize: '22px', textAlign: 'center' }}>-&gt;</div>
                {renderItem(offer.output.id, offer.output.count)}
                <button
                  onClick={() => handleTrade(offer)}
                  disabled={!canTrade}
                  style={{
                    height: '38px',
                    background: canTrade ? '#7fb069' : '#8a8a8a',
                    color: canTrade ? '#102010' : '#444',
                    borderTop: '3px solid #d9f0c8',
                    borderLeft: '3px solid #d9f0c8',
                    borderBottom: '3px solid #365f2d',
                    borderRight: '3px solid #365f2d',
                    cursor: canTrade ? 'pointer' : 'not-allowed',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                  }}
                >
                  Trade
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ minHeight: '20px', marginTop: '12px', color: message.includes('Missing') ? '#7a1f1f' : '#245524' }}>
          {message}
        </div>
      </div>
    </div>
  );
};
