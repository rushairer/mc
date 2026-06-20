import React, { useState } from 'react';
import type { ItemStack } from '../types';

interface BookUIProps {
  item: ItemStack;
  editable: boolean;
  onClose: () => void;
  onSave: (pages: string[], title?: string) => void;
}

export const BookUI: React.FC<BookUIProps> = ({ item, editable, onClose, onSave }) => {
  const initialPages = item.book?.pages?.length ? item.book.pages : [''];
  const [pages, setPages] = useState<string[]>(initialPages);
  const [pageIndex, setPageIndex] = useState(0);
  const [title, setTitle] = useState(item.book?.title ?? item.customName ?? '');

  const currentPage = pages[pageIndex] ?? '';
  const signed = item.id === 387 || item.book?.signed;

  const updatePage = (value: string) => {
    const next = [...pages];
    next[pageIndex] = value.slice(0, 1024);
    setPages(next);
  };

  const addPage = () => {
    if (!editable || pages.length >= 50) return;
    const next = [...pages, ''];
    setPages(next);
    setPageIndex(next.length - 1);
  };

  const saveDraft = () => onSave(pages);
  const signBook = () => {
    const cleanTitle = title.trim() || 'Written Book';
    onSave(pages, cleanTitle);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 270,
        fontFamily: '"Courier New", monospace',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 'min(82vw, 520px)',
          minHeight: '560px',
          background: '#d8c29a',
          border: '6px solid #5b3b21',
          boxShadow: '0 16px 32px rgba(0,0,0,0.55), inset 0 0 0 4px #f0dfba',
          padding: '22px',
          color: '#24170d',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', minHeight: '24px' }}>
          {signed ? (item.book?.title ?? item.customName ?? 'Written Book') : 'Book and Quill'}
        </div>
        {signed && (
          <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '4px', color: '#5d4630' }}>
            by {item.book?.author ?? 'Steve'}
          </div>
        )}

        <textarea
          value={currentPage}
          onChange={(e) => updatePage(e.target.value)}
          readOnly={!editable}
          spellCheck={false}
          style={{
            marginTop: '18px',
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: '#ead8b4',
            boxShadow: 'inset 0 0 0 2px rgba(76, 49, 26, 0.35)',
            padding: '18px',
            fontFamily: '"Courier New", monospace',
            fontSize: '15px',
            lineHeight: 1.55,
            color: '#24170d',
          }}
        />

        {editable && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 32))}
            placeholder="Title"
            style={{
              marginTop: '14px',
              padding: '9px 12px',
              background: '#ead8b4',
              border: '2px solid #7b5a35',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              outline: 'none',
            }}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
          <button onClick={() => setPageIndex(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0} style={buttonStyle}>
            Previous
          </button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>
            Page {pageIndex + 1} of {pages.length}
          </div>
          <button
            onClick={() => setPageIndex(Math.min(pages.length - 1, pageIndex + 1))}
            disabled={pageIndex >= pages.length - 1}
            style={buttonStyle}
          >
            Next
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          {editable && <button onClick={addPage} style={buttonStyle}>New Page</button>}
          {editable && <button onClick={saveDraft} style={buttonStyle}>Done</button>}
          {editable && <button onClick={signBook} style={buttonStyle}>Sign</button>}
          {!editable && <button onClick={onClose} style={{ ...buttonStyle, flex: 1 }}>Done</button>}
        </div>
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  padding: '9px 12px',
  background: '#5c5c5c',
  border: '3px solid #000',
  borderTopColor: '#8c8c8c',
  borderLeftColor: '#8c8c8c',
  color: '#e0e0e0',
  fontFamily: '"Courier New", monospace',
  fontSize: '13px',
  fontWeight: 'bold',
  cursor: 'pointer',
  textShadow: '2px 2px 0 #000',
};
