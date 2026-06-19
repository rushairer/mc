import { useState, useEffect, useCallback, useRef } from 'react';

interface EndPoemUIProps {
  onComplete: () => void;
  playerName?: string;
}

interface PoemLine {
  text: string;
  speaker: 1 | 2 | 0; // 1 = green, 2 = cyan, 0 = neutral/credits
  blank?: boolean;
}

const SPEAKER_1_COLOR = '#55FF55'; // light green
const SPEAKER_2_COLOR = '#55FFFF'; // cyan
const CREDITS_COLOR = '#AAAAAA';

const SCROLL_SPEED = 0.6; // pixels per frame
const MAX_DURATION_MS = 60_000;
const LINE_HEIGHT_PX = 28;
const BLANK_HEIGHT_PX = 28;
const SECTION_GAP_PX = 56;

function buildPoemLines(playerName: string): PoemLine[] {
  // Original two-voice philosophical poem for this game
  const dialogue: [string, 1 | 2][] = [
    ['I see the player you mean.', 1],
    [`${playerName}?`, 2],
    ['Yes. Take care. It has reached a higher level now. It can read our thoughts.', 1],
    ['That doesn\'t matter. It thinks we are part of the game.', 2],
    ['I like this player. It played well. It did not give up.', 1],
    ['It is reading our words as though they were words on a screen.', 2],
    ['That is how it chooses to imagine many things, when it is deep in the dream of a game.', 1],
    ['Words make a wonderful interface. Very flexible.', 2],
    ['They are better than many other interfaces that were tried.', 1],
    ['Yes. Words are the interface. The last one, the final interface.', 2],
    ['And what did this player dream?', 1],
    ['This player dreamed of sunlight and trees. Of fire and water.', 2],
    ['It dreamed it created. And it dreamed it destroyed.', 1],
    ['It dreamed it hunted, and was hunted. It dreamed of shelter.', 2],
    ['Hah, the original interface. A million years old, and it still works.', 1],
    ['But what true structure did this player create, in the reality behind the screen?', 2],
    ['It worked, with a million others, to sculpt a true world in a true void.', 1],
    ['It cannot read that thought.', 2],
    ['No. It has not yet achieved the highest level.', 1],
    ['That, the player must achieve on its own.', 2],
    ['Sometimes the player created small, private worlds that were not shared with anyone.', 1],
    ['Sometimes the player read words on a screen, and imagined they were thoughts.', 2],
    ['And the game was over and the player woke up from the dream. And the player began a new dream.', 1],
    ['And the player dreamed again, dreamed better.', 2],
    ['And the player was the universe. And the player was love.', 1],
    ['You are the player.', 2],
    ['Wake up.', 1],
  ];

  const lines: PoemLine[] = [];

  // Add initial blank space (screen height worth)
  for (let i = 0; i < 20; i++) {
    lines.push({ text: '', speaker: 0, blank: true });
  }

  // Poem lines with blank lines between them for pacing
  for (const [text, speaker] of dialogue) {
    lines.push({ text, speaker });
    lines.push({ text: '', speaker: 0, blank: true });
  }

  // Gap before credits
  for (let i = 0; i < 8; i++) {
    lines.push({ text: '', speaker: 0, blank: true });
  }

  // Credits section
  const creditsLines: string[] = [
    'MINECRAFT',
    '',
    'A game by Mojang',
    '',
    '',
    '───────────────',
    '',
    '',
    'Web Edition',
    'Powered by Three.js & React',
    '',
    '',
    '───────────────',
    '',
    '',
    'Thank you for playing!',
    '',
  ];

  for (const line of creditsLines) {
    if (line === '') {
      lines.push({ text: '', speaker: 0, blank: true });
    } else {
      lines.push({ text: line, speaker: 0 });
    }
  }

  // Trailing blank space so text scrolls fully off screen
  for (let i = 0; i < 25; i++) {
    lines.push({ text: '', speaker: 0, blank: true });
  }

  return lines;
}

export function EndPoemUI({ onComplete, playerName = 'PLAYER' }: EndPoemUIProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const poemLines = useRef<PoemLine[]>(buildPoemLines(playerName));

  const totalContentHeight = poemLines.current.reduce((acc, line) => {
    return acc + (line.blank ? BLANK_HEIGHT_PX : LINE_HEIGHT_PX);
  }, 0);

  const handleComplete = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    onComplete();
  }, [onComplete]);

  // Fade in on mount
  useEffect(() => {
    const fadeTimer = setTimeout(() => setOpacity(1), 50);
    return () => clearTimeout(fadeTimer);
  }, []);

  // Scroll animation
  useEffect(() => {
    startTimeRef.current = performance.now();
    let lastTime = performance.now();

    const animate = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      // Cap delta to avoid huge jumps if tab was backgrounded
      const clampedDelta = Math.min(delta, 100);
      const pixelsPerMs = SCROLL_SPEED / 16.667; // normalize to ~60fps

      setScrollOffset(prev => {
        const next = prev + pixelsPerMs * clampedDelta;
        // End when content has fully scrolled past
        if (next >= totalContentHeight) {
          handleComplete();
          return prev;
        }
        return next;
      });

      // Max duration safety net
      if (now - startTimeRef.current >= MAX_DURATION_MS) {
        handleComplete();
        return;
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [totalContentHeight, handleComplete]);

  // ESC key to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleComplete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleComplete]);

  const getLineColor = (line: PoemLine): string => {
    if (line.speaker === 1) return SPEAKER_1_COLOR;
    if (line.speaker === 2) return SPEAKER_2_COLOR;
    return CREDITS_COLOR;
  };

  const getLineStyle = (line: PoemLine): React.CSSProperties => {
    const isCredits = line.speaker === 0 && !line.blank;
    return {
      color: getLineColor(line),
      fontSize: isCredits && line.text === 'MINECRAFT' ? '28px' : '16px',
      fontWeight: isCredits && line.text === 'MINECRAFT' ? 'bold' : 'normal',
      letterSpacing: isCredits && line.text === 'MINECRAFT' ? '8px' : '1px',
      textAlign: 'center' as const,
      padding: '2px 20px',
      lineHeight: `${LINE_HEIGHT_PX}px`,
      textShadow: '1px 1px 3px rgba(0,0,0,0.8)',
      whiteSpace: 'pre-wrap' as const,
      maxWidth: '700px',
      margin: '0 auto',
    };
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: '#000',
        zIndex: 9999,
        overflow: 'hidden',
        fontFamily: '"Courier New", monospace',
        opacity,
        transition: 'opacity 1s ease-in',
        cursor: 'default',
      }}
    >
      {/* Scrolling content */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(-${scrollOffset}px)`,
          willChange: 'transform',
          paddingTop: '50vh',
        }}
      >
        {poemLines.current.map((line, i) => (
          line.blank ? (
            <div key={i} style={{ height: BLANK_HEIGHT_PX }} />
          ) : (
            <div key={i} style={getLineStyle(line)}>
              {line.text}
            </div>
          )
        ))}
      </div>

      {/* Skip button */}
      <button
        onClick={handleComplete}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: '"Courier New", monospace',
          fontSize: '13px',
          padding: '6px 16px',
          cursor: 'pointer',
          zIndex: 10000,
          borderRadius: '2px',
          transition: 'background 0.2s, color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
        }}
      >
        Skip [ESC]
      </button>
    </div>
  );
}
