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
