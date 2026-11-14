import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lessonCues } from '../src/domain/lesson-cues.ts';

test('uses explicit clip boundaries across gaps and retains legacy timestamp support', () => {
  const cues = lessonCues('Recording: lesson-2\n[00:15:26.20–929.37] Fill in the gaps.\n[00:15:48] Compare your answers.\n[00:15:50] Off you go.');
  assert.deepEqual(cues.map(({ start, end }) => [start, end]), [[926.2, 929.37], [948, 950], [950, 953]]);
});
