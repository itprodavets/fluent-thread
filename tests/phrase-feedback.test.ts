import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareSpokenPhrase } from '../src/domain/speech-feedback.ts';

test('flags missing, changed and extra words without shifting matching words', () => {
  const result = compareSpokenPhrase('Bear with me for a couple of minutes.', 'Bear me for a couple of minute please', 'en');
  assert.deepEqual(result.filter(word => word.kind !== 'match'), [
    { kind: 'missing', expected: 'with' },
    { kind: 'changed', expected: 'minutes', heard: 'minute' },
    { kind: 'extra', heard: 'please' }
  ]);
});

test('ignores punctuation and case and matches expanded contractions', () => {
  const result = compareSpokenPhrase('I’m here, and I can’t wait!', 'i am here and I cannot wait', 'en-GB');
  assert.ok(result.length && result.every(word => word.kind === 'match'));
});

test('repeated and reordered words still have to occur in the expected order', () => {
  const repeated = compareSpokenPhrase('Very, very good', 'Very good.', 'en');
  assert.equal(repeated.filter(word => word.kind === 'missing').length, 1);
  assert.ok(compareSpokenPhrase('Let me know', 'Let know me', 'en').some(word => word.kind !== 'match'));
  assert.deepEqual(compareSpokenPhrase('One word', '', 'en').map(word => word.kind), ['missing', 'missing']);
});
