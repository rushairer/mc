import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCaveDripInterval,
  getCaveDripPitch,
  getRainFilterFrequency,
  getRainGain,
} from '../src/systems/AmbientRules';

test('rain gain is silent when clear and scales with weather', () => {
  assert.equal(getRainGain('clear'), 0);
  assert.ok(getRainGain('rain') > 0);
  assert.ok(getRainGain('thunder') > getRainGain('rain'), 'thunder is louder than rain');
});

test('cave drip timing and pitch stay in audible ranges', () => {
  for (let i = 0; i < 20; i++) {
    const interval = getCaveDripInterval(() => Math.random());
    assert.ok(interval >= 3 && interval <= 8, `interval ${interval}`);
    const pitch = getCaveDripPitch(() => Math.random());
    assert.ok(pitch >= 600 && pitch <= 900, `pitch ${pitch}`);
  }
});

test('thunder rain is darker (lower filter cutoff) than plain rain', () => {
  assert.ok(getRainFilterFrequency('thunder') < getRainFilterFrequency('rain'));
});
