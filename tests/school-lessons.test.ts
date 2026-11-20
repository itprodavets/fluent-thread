import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schoolLessonGroups } from '../src/domain/school-lessons.ts';
import { applyChatPackage, parseChatPackage } from '../src/domain/chat-package.js';
import type { DatedLesson } from '../src/domain/school-lessons';
import type { Topic } from '../src/domain/model';

const dated: DatedLesson[] = JSON.parse(readFileSync(new URL('../materials/en/lessons/catalog.json', import.meta.url), 'utf8'));
const topic = (id: string, title: string): Topic => ({ id, title, language: 'en', links: [], prompt: '' });

test('legacy topics are grouped under their schools and a search opens the matching dialogue', () => {
  const plans = dated.find(item => item.school === 'ACE TEFL')!;
  const topics = [topic('plans', plans.previousTitle!), topic('own', 'Мои заметки')];
  const dialogues = new Map([['plans', [
    { id: 'match', title: 'Один лишний билет на футбол' },
    { id: 'theatre', title: 'Билеты в театр' }
  ]]]);
  assert.deepEqual(schoolLessonGroups(topics, dated, dialogues, '').map(group => group.school), ['ACE TEFL', 'Темы без школы']);
  const result = schoolLessonGroups(topics, dated, dialogues, 'ACE футбол');
  assert.deepEqual(result.map(group => group.lessons.flatMap(lesson => lesson.matches.map(match => match.id))), [['match']]);
});

test('import persists a school and lesson date without changing user-edited source', () => {
  const raw = { format: 'nit-rechi', version: 1, language: 'en', topic: { title: 'A class', source: { school: 'School', date: '2026-11-16' } }, words: [{ title: 'one' }] };
  const state = { language: 'en', languages: { en: {} }, words: [], topics: [], resources: [], results: {} };
  const result = applyChatPackage(state, parseChatPackage(JSON.stringify(raw)));
  assert.deepEqual(result.topic.source, raw.topic.source);
  const changed = { ...raw, topic: { ...raw.topic, source: { school: 'Other', date: '2026-11-16' } } };
  assert.deepEqual(applyChatPackage(result.next, parseChatPackage(JSON.stringify(changed)), result.topic.id).topic.source, raw.topic.source);
  assert.throws(() => parseChatPackage(JSON.stringify({ ...raw, topic: { ...raw.topic, source: { school: 'School', date: '2026-02-30' } } })), /дату занятия/);
});
