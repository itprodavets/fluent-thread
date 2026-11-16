import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyChatPackage, parseChatPackage } from '../src/domain/chat-package.js';
import { dialogueChoices, importedLessonsFor } from '../src/domain/imported-lessons.ts';
import { skillMatches } from '../src/domain/skill-dialogues.ts';

const read = (file: string) => JSON.parse(readFileSync(new URL('../materials/' + file, import.meta.url), 'utf8'));

test('every published skill resolves to a teachable dialogue from each of the three schools', () => {
  const dated = read('2026-11-16/lessons.json');
  const skills = read('2026-11-16/skills.json');
  let study = { language: 'en', languages: { en: {} }, words: [], topics: [], resources: [], results: {} };
  for (const name of ['wolves-and-eco-homes', 'future-plans', 'responses-and-opinions']) {
    const path = new URL('../materials/2026-11-16/' + name + '.json', import.meta.url);
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
  const { programs } = read('schools/programs.json');
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
