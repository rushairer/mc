import { useState, useRef, useEffect } from 'react';

interface ChatBarProps {
  open: boolean;
  messages: string[];
  onSubmit: (message: string) => void;
}

export function ChatBar({ open, messages, onSubmit }: ChatBarProps) {
  const [input, setInput] = useState('/');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput('/');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open && messages.length === 0) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) {
        onSubmit(input.trim());
        setInput('/');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onSubmit('');
    }
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: 40,
      left: 10,
      right: 10,
      maxWidth: 600,
      pointerEvents: open ? 'auto' : 'none',
      fontFamily: 'monospace',
      zIndex: 100,
    }}>
      {/* Message history */}
      <div style={{
        maxHeight: 200,
        overflow: 'hidden',
        marginBottom: 4,
      }}>
        {(open ? messages : messages.slice(-3)).map((msg, i) => (
          <div key={i} style={{
            color: '#fff',
            textShadow: '1px 1px 2px #000',
            fontSize: 13,
            padding: '2px 4px',
            background: 'rgba(0,0,0,0.3)',
            marginBottom: 1,
          }}>
            {msg}
          </div>
        ))}
      </div>

      {/* Input */}
      {open && (
        <div style={{
          display: 'flex',
          background: 'rgba(0,0,0,0.6)',
          border: '2px solid #555',
          padding: 4,
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: 14,
              outline: 'none',
              padding: '4px 8px',
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
