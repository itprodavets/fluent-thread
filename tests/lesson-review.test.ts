import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessTeacherPhrase, phraseRetryDelay } from '../src/domain/lesson-practice.ts';
import { lessonReviewQueue } from '../src/domain/lesson-review.ts';
import type { PracticeResult, Study } from '../src/domain/model.ts';

const now = Date.parse('2026-11-17T12:00:00Z');
const result = (due: number, mode?: PracticeResult['mode']): PracticeResult =>
  ({ due, mode, level: 1, result: 'independent', attempts: 1, updated: now - 86_400_000 });

function studyWithLessons(): Study {
  const word = (id: string, language = 'en') => ({ id, language, title: id, meaning: 'Meaning of ' + id, example: '' });
  return {
    language: 'en', languages: { en: {} }, resources: [],
    words: ['shared', 'old', 'future', 'new', 'unlinked', 'written'].map(id => word(id)).concat(word('spanish', 'es')),
    topics: [
      { id: 'first', language: 'en', title: 'First lesson', links: ['shared', 'old', 'future', 'new', 'written'], prompt: '' },
      { id: 'second', language: 'en', title: 'Second lesson', links: ['shared', 'spanish'], prompt: '' },
      { id: 'other', language: 'es', title: 'Spanish lesson', links: ['old'], prompt: '' },
    ],
    results: {
      shared: { ...result(now - 50, 'written'), schedules: { spoken: { due: now, level: 1 } } },
      old: result(now - 100),
      future: { ...result(now - 50, 'written'), schedules: { spoken: { due: now + 200, level: 1 } } },
      unlinked: result(now - 10),
      written: result(now - 10, 'written'),
      spanish: result(now - 10)
    },
  };
}

test('daily review merges due cards across lessons, using the spoken schedule when present', () => {
  const queue = lessonReviewQueue(studyWithLessons(), now);
  assert.deepEqual(queue.due.map(item => item.word.id), ['old', 'shared']);
  assert.deepEqual(queue.due[1].topics.map(topic => topic.id), ['first', 'second']);
  assert.deepEqual(queue.due[0].topics.map(topic => topic.id), ['first']);
  assert.equal(queue.nextAt, now + 200);
});

test('a rated card leaves the queue immediately and a retry returns when the delay ends', () => {
  const study = studyWithLessons();
  const first = study.words.find(word => word.id === 'old')!;
  const shared = study.words.find(word => word.id === 'shared')!;
  const known = assessTeacherPhrase(study, first, 'independent', now);
  const missed = assessTeacherPhrase(known, shared, 'retry', now);
  assert.deepEqual(lessonReviewQueue(missed, now).due, []);
  assert.deepEqual(lessonReviewQueue(missed, now + phraseRetryDelay - 1).due.map(item => item.word.id), ['future']);
  assert.deepEqual(lessonReviewQueue(missed, now + phraseRetryDelay).due.map(item => item.word.id), ['future', 'shared']);
});
