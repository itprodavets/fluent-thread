import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnSilence } from '../src/domain/turn-silence.ts';

test('initial silence and brief clicks never submit an empty response', () => {
  const detect = turnSilence(0);
  assert.equal(detect(3000, 0), 'listen');
  assert.equal(detect(3050, .1), 'listen');
  assert.equal(detect(3100, 0), 'listen');
  assert.equal(detect(15000, 0), 'no-speech');
});

test('speech is followed by a pause, not an immediate transition', () => {
  const detect = turnSilence(0);
  detect(500, .08);
  detect(700, .08);
  assert.equal(detect(1300, 0), 'listen');
  detect(1500, .08);
  assert.equal(detect(3299, 0), 'listen');
  assert.equal(detect(3300, 0), 'complete');
});
