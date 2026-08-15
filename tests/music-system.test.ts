import assert from 'node:assert/strict';
import test from 'node:test';
import { getChordNotes, getMusicMode, MUSIC_BAR_SECONDS, type MusicMode } from '../src/systems/MusicSystem';

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

// ─── Mode selection (P4.1) ───

test('music mode follows day/night and underground state', () => {
  assert.equal(getMusicMode(false, false), 'day');
  assert.equal(getMusicMode(true, false), 'night');
  assert.equal(getMusicMode(false, true), 'cave');
  assert.equal(getMusicMode(true, true), 'cave', 'underground wins over night');
});

// ─── Chord generation (P4.1) ───

test('chords contain 3-4 audible notes within the bar', () => {
  for (const mode of ['day', 'night', 'cave'] as MusicMode[]) {
    const notes = getChordNotes(mode, 0, seq([0.5, 0.1, 0.7, 0.3]));
    assert.ok(notes.length >= 3 && notes.length <= 4, `${mode} chord size ${notes.length}`);
    for (const note of notes) {
      assert.ok(note.freq >= 55 && note.freq <= 1200, `${mode} freq ${note.freq} in range`);
      assert.ok(note.duration > 0 && note.duration <= MUSIC_BAR_SECONDS);
      assert.ok(note.startOffset >= 0 && note.startOffset < MUSIC_BAR_SECONDS);
      assert.ok(note.gain > 0 && note.gain <= 0.1, 'quiet ambient gain');
    }
  }
});

test('chord generation is deterministic for a fixed rng', () => {
  const a = getChordNotes('day', 3, seq([0.2, 0.8, 0.4, 0.6]));
  const b = getChordNotes('day', 3, seq([0.2, 0.8, 0.4, 0.6]));
  assert.deepEqual(a, b);
});

test('the progression advances its root across bars', () => {
  const bar0 = getChordNotes('day', 0, seq([0.5, 0.1, 0.7, 0.3]));
  const bar1 = getChordNotes('day', 1, seq([0.5, 0.1, 0.7, 0.3]));
  const root0 = Math.min(...bar0.map((n) => n.freq));
  const root1 = Math.min(...bar1.map((n) => n.freq));
  assert.notEqual(root0, root1, 'different bars use different roots');
});

test('cave chords sit lower than day chords', () => {
  const day = Math.min(...getChordNotes('day', 2, seq([0.5, 0.1, 0.7, 0.3])).map((n) => n.freq));
  const cave = Math.min(...getChordNotes('cave', 2, seq([0.5, 0.1, 0.7, 0.3])).map((n) => n.freq));
  assert.ok(cave < day, 'cave is darker/lower');
});
