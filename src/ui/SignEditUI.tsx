import React, { useState, useEffect, useRef } from 'react';

interface SignEditUIProps {
  onSave: (lines: string[]) => void;
  initialLines?: string[];
}

export function SignEditUI({ onSave, initialLines = ['', '', '', ''] }: SignEditUIProps) {
  const [lines, setLines] = useState<string[]>(initialLines);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Auto-focus the first input on mount
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleChange = (index: number, val: string) => {
    // Limit to 15 characters per line (standard Minecraft sign limit)
    const truncated = val.slice(0, 15);
    const newLines = [...lines];
    newLines[index] = truncated;
    setLines(newLines);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < 3) {
        inputRefs[index + 1].current?.focus();
      } else {
        onSave(lines);
      }
    } else if (e.key === 'ArrowDown' && index < 3) {
      inputRefs[index + 1].current?.focus();
    } else if (e.key === 'ArrowUp' && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onSave(lines);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: '"Courier New", monospace',
        userSelect: 'none',
      }}
    >
      <div style={{ color: '#fff', fontSize: '20px', marginBottom: '20px', textShadow: '2px 2px 0 #000' }}>
        Edit Sign Message
      </div>

      {/* Wooden Sign Board Representation */}
      <div
        style={{
          width: '280px',
          padding: '24px 16px',
          background: '#a07040',
          border: '4px solid #604020',
          borderRadius: '4px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {lines.map((line, idx) => (
          <input
            key={idx}
            ref={inputRefs[idx]}
            type="text"
            value={line}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            style={{
              width: '90%',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px dashed rgba(255,255,255,0.2)',
              color: '#000',
              textAlign: 'center',
              fontSize: '18px',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              outline: 'none',
            }}
            placeholder={`Line ${idx + 1}`}
          />
        ))}
      </div>

      <button
        onClick={() => onSave(lines)}
        style={{
          marginTop: '24px',
          padding: '10px 32px',
          fontSize: '16px',
          fontFamily: '"Courier New", monospace',
          background: '#4a4a4a',
          color: '#fff',
          border: '2px solid #666',
          cursor: 'pointer',
          boxShadow: '3px 3px 0 #000',
          textShadow: '1px 1px 0 #000',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#666';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#4a4a4a';
        }}
      >
        Done
      </button>
    </div>
  );
}
