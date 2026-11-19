import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseChatPackage, applyChatPackage } from '../src/domain/chat-package.js';
import { assessPhraseCard, lessonPractice, teacherPhraseCards } from '../src/domain/lesson-practice.ts';
import type { Study } from '../src/domain/model.ts';

test('story lesson imports all levels and neutral phrase cards without duplicating or resetting progress', () => {
  const packet = parseChatPackage(readFileSync(new URL('../materials/resources/story-of-an-hour.json', import.meta.url), 'utf8'));
  const initial: Study = { language: 'en', languages: { en: {} }, words: [], topics: [], resources: [], results: {} };
  const first = applyChatPackage(initial, packet);
  assert.equal(first.next.words.length, 48);
  for (const kind of ['reading', 'dialogue']) {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      assert.ok(first.next.resources.some(item => item.kind === kind && item.title.endsWith(' · ' + level) && item.translation));
    }
  }
  const { teacher, grammar, exercises } = lessonPractice(first.next.resources, first.topic.id);
  assert.equal(grammar.length, 1);
  assert.equal(exercises.length, 10);
  const cards = teacherPhraseCards(teacher[0].text);
  assert.equal(cards.length, 10);
  assert.ok(cards.every(card => !card.time && card.meaning && card.example));
  const learned = assessPhraseCard(first.next, { ...cards[0], topicId: first.topic.id }, 'en', 'retry', 1000);
  const again = applyChatPackage(learned, packet);
  assert.equal(again.wordsAdded, 0);
  assert.equal(again.materialsAdded, 0);
  assert.equal(again.next.topics.length, 1);
  assert.deepEqual(again.next.results, learned.results);
});
