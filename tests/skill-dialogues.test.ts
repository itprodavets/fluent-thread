import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyChatPackage, parseChatPackage } from '../src/domain/chat-package.js';
import { dialogueChoices, importedLessonsFor } from '../src/domain/imported-lessons.ts';
import { skillMatches } from '../src/domain/skill-dialogues.ts';

import { lessonPath, readLesson } from './material-fixtures.ts';

const read = (file: string) => JSON.parse(readFileSync(new URL('../materials/' + file, import.meta.url), 'utf8'));

test('every published skill resolves to a teachable dialogue from each of the three schools', () => {
  const dated = read('en/lessons/catalog.json');
  const skills = read('en/skills/catalog.json');
  let study = { language: 'en', languages: { en: {} }, words: [], topics: [], resources: [], results: {} };
  for (const name of ['wolves-and-eco-homes', 'future-plans', 'responses-and-opinions']) {
    const path = lessonPath(name);
    study = applyChatPackage(study, parseChatPackage(readFileSync(path, 'utf8'))).next;
  }
  const lessons = importedLessonsFor(study);
  const dialogues = new Map(study.topics.map((topic: { id: string }) => [
    topic.id, dialogueChoices(lessons.filter(lesson => lesson.topicId === topic.id)).map(choice =>
      ({ id: choice.versions.find(version => version.level === 'B2')!.id, title: choice.title }))
  ]));
  for (const skill of skills) {
    const matches = skillMatches(skill, study.topics, dated, dialogues);
    assert.equal(new Set(matches.map(match => match.school)).size, 3);
    assert.ok(matches.every(match => match.prompt && match.answer));
  }
});

test('school catalogue keeps unique programs and public registration links', () => {
  const { programs } = read('en/schools/programs.json');
  assert.ok(programs.length >= 40);
  assert.equal(new Set(programs.map((program: { name: string }) => program.name)).size, programs.length);
  for (const program of programs) {
    assert.ok(['free', 'limited', 'check', 'paid', 'self'].includes(program.category));
    for (const value of [program.link, program.site]) {
      const url = new URL(value);
      assert.ok(['https:', 'mailto:'].includes(url.protocol));
      assert.equal(url.username + url.password, '');
    }
  }
});

test('skill phrase provenance and retry survive selection of another dialogue', async () => {
  const { assessPhraseCard, phraseReviews, phraseRetryDelay, phraseVocabularyId } = await import('../src/domain/lesson-practice.ts');
  const { skillPhraseCards } = await import('../src/domain/skill-dialogues.ts');
  const { lastSpoken } = await import('../src/domain/model.ts');
  const packets = read('en/lessons/catalog.json').map((item: { path: string }) => read('en/' + item.path));
  const skills = read('en/skills/catalog.json');
  for (const skill of skills) {
    assert.ok(skill.dialogues.flatMap((dialogue: { phrases: unknown[] }) => dialogue.phrases).length >= 6);
    for (const item of skill.dialogues) {
      const packet = packets.find(entry => entry.topic.source.school === item.school && entry.materials.some((material: { kind: string; title: string }) => material.kind === 'dialogue' && material.title.startsWith(item.title + ' · ')));
      assert.ok(packet);
      const dialogue = packet.materials.filter((material: { kind: string; title: string }) =>
        material.kind === 'dialogue' && material.title.startsWith(item.title + ' · '));
      for (const card of item.phrases) {
        const sources = card.origin === 'диалог' ? dialogue.map((row: { text: string }) => row.text) : [item.answer];
        assert.ok(sources.some((source: string) => source.toLocaleLowerCase().includes(card.phrase.replace(/[.?!]+$/, '').toLocaleLowerCase())), card.phrase);
      }
    }
  }
  const first = skills[0].dialogues[0];
  const cards = skillPhraseCards([{...first, topicId: 'lesson', dialogueId: 'dialogue'}]);
  const card = cards[0];
  const initial = { language: 'en', languages: { en: {} }, words: [], topics: [
    { id: 'lesson', title: 'Lesson', language: 'en', links: [], prompt: '' }
  ], resources: [], results: {} };
  const now = 1_800_000_000_000;
  const retry = assessPhraseCard(initial, card, 'en', 'retry', now);
  const id = phraseVocabularyId(card, 'en');
  assert.deepEqual(retry.topics[0].links, [id]);
  assert.equal(phraseReviews(retry, cards, now).pending.get(id), now + phraseRetryDelay);
  assert.ok(phraseReviews(retry, cards, now + phraseRetryDelay).due.has(id));
  const known = assessPhraseCard(retry, card, 'en', 'independent', now + phraseRetryDelay);
  assert.equal(known.words.length, 1);
  assert.equal(lastSpoken(known.results[id]).outcome, 'independent');
  assert.equal(phraseReviews(known, cards, now + phraseRetryDelay).due.size, 0);
});
