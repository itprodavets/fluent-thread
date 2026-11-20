import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lessonCues } from '../src/domain/lesson-cues.ts';
import { matchPhraseSource, phraseSource, recordingTime, saveTranscriptPhrase } from '../src/domain/lesson-transcript.ts';
import type { TranscriptLine } from '../src/domain/lesson-transcript.ts';

test('transcript timestamps retain hour boundaries', () => {
  assert.equal(recordingTime(3606.81), '01:00:06');
});

test('November 17 transcript covers the teaching sections on both sides of the break', () => {
  const path = new URL('../materials/en/lessons/dc-public-library/conversation-and-values/', import.meta.url);
  const lines: TranscriptLine[] = JSON.parse(readFileSync(new URL('transcript.json', path), 'utf8'));
  const packet = JSON.parse(readFileSync(new URL('lesson.json', path), 'utf8'));
  const audio = packet.materials.find((item: { title: string }) => item.title === 'Запись урока с таймкодами');
  const chapters = lessonCues(audio.text);
  assert.ok(lines.length > 1400);
  assert.ok(lines.every((line, index) => line.end > line.start && line.en && line.ru
    && (index === 0 || line.start >= lines[index - 1].start)));
  assert.equal(chapters.filter(cue => !lines.some(line => line.start < cue.end && line.end > cue.start)).length, 1);
  assert.ok(lines.some(line => line.teacher && line.en.includes('entirely up to you')));
  assert.ok(lines.some(line => line.teacher && line.en.includes('Acquired knowledge')));
});

test('saving transcript phrases updates the same study card and keeps its review history', () => {
  const topic = { id: 'lesson', language: 'en', title: 'Lesson', links: [], prompt: '' };
  const initial = { language: 'en', languages: { en: {} }, words: [], topics: [topic], resources: [], results: {} };
  const input = { language: 'en', title: 'Bear with me.', meaning: 'Потерпите минутку.', example: '', topicId: topic.id } as const;
  const source = phraseSource('lesson-2026-11-17', { start: 125.52, end: 140.54, en: input.title, ru: input.meaning });
  const passive = saveTranscriptPhrase(initial, { ...input, level: 'passive', audioSource: source });
  const [word] = passive.words;
  assert.deepEqual(passive.topics[0].links, [word.id]);
  assert.equal(word.vocabularyLevel, 'passive');
  const result = { level: 2, result: 'independent' as const, due: 100, attempts: 3, updated: 10 };
  const active = saveTranscriptPhrase({ ...passive, results: { [word.id]: result } },
    { ...input, title: 'bear with me', level: 'active' });
  assert.equal(active.words.length, 1);
  assert.equal(active.words[0].id, word.id);
  assert.equal(active.words[0].vocabularyLevel, 'active');
  assert.deepEqual(active.words[0].audioSource, source);
  assert.equal(active.results[word.id], result);
  assert.deepEqual(active.topics[0].links, [word.id]);
});

test('legacy phrases only recover original audio from an unambiguous line or saved context', () => {
  const line = {start: 10, end: 14, en: 'Bear with me. I’ll be right with you.', ru: 'Потерпите. Я сейчас вернусь.'};
  assert.equal(matchPhraseSource('lesson', [line], "I'll be right with you", line.en)?.start, 10);
  assert.equal(matchPhraseSource('lesson', [line], "right with you", ''), undefined);
  assert.equal(matchPhraseSource('lesson', [line], "I'll be right with you", '')?.start, 10);
  assert.equal(matchPhraseSource('lesson', [line, {...line, start: 20, end: 24}], line.en, ''), undefined);
  assert.deepEqual(matchPhraseSource('lesson', [line], line.en, ''), phraseSource('lesson', line));
});
