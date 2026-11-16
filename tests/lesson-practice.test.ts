import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lessonPractice, teacherPhraseCards } from '../src/domain/lesson-practice.ts';
import type { Resource } from '../src/domain/model.ts';

test('dated packages expose only the selected lesson’s phrases, rules and practice', () => {
  for (const [file, count] of [['wolves-and-eco-homes', 4], ['future-plans', 4], ['responses-and-opinions', 5]] as const) {
    const path = new URL(`../materials/2026-11-16/${file}.json`, import.meta.url);
    const packet = JSON.parse(readFileSync(path, 'utf8'));
    const entries: Resource[] = packet.materials.map((entry: Resource, index: number) =>
      ({ ...entry, id: String(index), topicId: file, language: packet.language }));
    const unrelated = entries.map(entry => ({ ...entry, topicId: 'other' }));
    const { teacher, grammar, exercises } = lessonPractice([...entries, ...unrelated], file);
    assert.equal(teacher.length, 1);
    assert.equal(grammar.length, 1);
    assert.equal(exercises.length, count);
    const cards = teacherPhraseCards(teacher[0].text);
    assert.equal(cards.length, 12);
    assert.ok(cards.every(card => card.phrase && card.meaning && card.pattern && card.example));
    assert.ok(cards.every(card => packet.words.some((word: { title: string; meaning: string }) =>
      word.title === card.phrase.replace(/[.?!]+$/, '') && word.meaning === card.meaning)));
  }
});

test('a missed teacher phrase returns after the delay and a usable phrase leaves the retry queue', async () => {
  const { assessTeacherPhrase, phraseRetryDelay, teacherPhraseReviews } = await import('../src/domain/lesson-practice.ts');
  const { assess, lastSpoken } = await import('../src/domain/model.ts');
  const { applyChatPackage, parseChatPackage } = await import('../src/domain/chat-package.js');
  const { selectLearningTargets } = await import('../src/domain/learning-session.ts');
  const packet = parseChatPackage(readFileSync(new URL('../materials/2026-11-16/future-plans.json', import.meta.url), 'utf8'));
  const initial = { language: 'en', languages: { en: {} }, words: [], topics: [], resources: [], results: {} };
  const { next } = applyChatPackage(initial, packet);
  const word = next.words.find((item: { title: string }) => item.title === 'Have a think about it for a moment');
  assert.ok(word);
  const now = new Date('2026-11-16T12:00:00Z').getTime();
  const written = assess(next, word.id, 'independent', now, 'written');
  const retry = assessTeacherPhrase(written, word, 'retry', now);
  const due = now + phraseRetryDelay;
  assert.equal(retry.results[word.id].schedules?.written?.due, written.results[word.id].schedules?.written?.due);
  assert.equal(teacherPhraseReviews(retry, due - 1).pending.get(word.id), due);
  assert.equal(teacherPhraseReviews(retry, due - 1).due.has(word.id), false);
  assert.equal(teacherPhraseReviews(retry, due).due.has(word.id), true);
  assert.ok(selectLearningTargets(retry, new Map(), due, 5).some(target => target.wordId === word.id));
  const known = assessTeacherPhrase(retry, word, 'independent', due);
  assert.equal(lastSpoken(known.results[word.id]).outcome, 'independent');
  assert.equal(teacherPhraseReviews(known, due).due.has(word.id), false);
});
