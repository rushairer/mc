import React, { useMemo, useState } from 'react';
import { ItemRegistry } from '../items/ItemRegistry';
import {
  filterRecipeEntries,
  RECIPE_CATEGORIES,
  type RecipeBookEntry,
  type RecipeCategory,
} from '../items/RecipeBook';

interface RecipeBookUIProps {
  entries: RecipeBookEntry[];
  gridSize: 2 | 3;
  nameOf: (itemId: number) => string;
  getItemIconStyle: (id: number, size?: number) => any;
  onSelect: (entry: RecipeBookEntry) => void;
  onClose: () => void;
  title: string;
}

/**
 * P3.2 — Recipe book panel: search + category tabs + result grid. Clicking a
 * result asks the parent to auto-fill the crafting grid from the inventory.
 */
export const RecipeBookUI: React.FC<RecipeBookUIProps> = ({
  entries,
  gridSize,
  nameOf,
  getItemIconStyle,
  onSelect,
  onClose,
  title,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<RecipeCategory | 'all'>('all');

  const filtered = useMemo(
    () => filterRecipeEntries(entries, { query, category, nameOf }),
    [entries, query, category, nameOf],
  );

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60,
      fontFamily: '"Courier New", monospace',
    }}>
      <div style={{
        background: 'rgba(30,30,30,0.98)',
        border: '3px solid #888',
        borderRadius: '8px',
        padding: '16px',
        color: '#fff',
        width: '560px',
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#ffd966', textShadow: '1px 1px 0 #000' }}>
            {title} ({filtered.length})
          </span>
          <button
            onClick={onClose}
            style={{
              background: '#c22', color: '#fff', border: '2px solid #555',
              borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer',
              fontWeight: 'bold', fontFamily: 'monospace',
            }}
          >
            X
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          style={{
            padding: '6px 8px', background: '#111', border: '2px solid #555',
            color: '#fff', fontFamily: '"Courier New", monospace', fontSize: '13px', outline: 'none',
          }}
        />

        {/* Category tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {(['all', ...RECIPE_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '3px 8px', fontSize: '11px', cursor: 'pointer',
                background: category === cat ? '#3c6e3c' : '#333',
                border: category === cat ? '2px solid #7ab87a' : '2px solid #555',
                color: '#fff', textTransform: 'capitalize', fontFamily: '"Courier New", monospace',
              }}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>

        {/* Result grid */}
        <div style={{
          overflowY: 'auto', flex: 1, border: '2px solid #444', padding: '8px',
          display: 'grid', gridTemplateColumns: `repeat(${gridSize === 2 ? 7 : 8}, 48px)`,
          gap: '2px', alignContent: 'start', minHeight: '200px',
        }}>
          {filtered.map((entry) => {
            const item = ItemRegistry.get(entry.resultId);
            if (!item) return null;
            return (
              <div
                key={`${entry.resultId}-${entry.resultCount}`}
                title={`${nameOf(entry.resultId)} x${entry.resultCount}`}
                onClick={() => onSelect(entry)}
                style={{
                  width: 46, height: 46, border: '2px solid #666', background: 'rgba(60,60,60,0.9)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', position: 'relative', userSelect: 'none',
                }}
              >
                <div style={getItemIconStyle(entry.resultId, 32)} />
                {entry.resultCount > 1 && (
                  <span style={{ position: 'absolute', bottom: '1px', right: '3px', fontSize: '10px', fontWeight: 'bold' }}>
                    {entry.resultCount}
                  </span>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ color: '#888', fontSize: '12px', padding: '20px', gridColumn: '1 / -1' }}>
              No recipes match.
            </div>
          )}
        </div>

        <div style={{ fontSize: '10px', color: '#777' }}>
          Click a recipe to fill the {gridSize}x{gridSize} grid from your inventory.
        </div>
      </div>
    </div>
  );
};
