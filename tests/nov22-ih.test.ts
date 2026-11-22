import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseChatPackage, applyChatPackage } from '../src/domain/chat-package.js';
import { dialogueVersion } from '../src/domain/imported-lessons.ts';
import { teacherPhraseCards } from '../src/domain/lesson-practice.ts';
import { lessonCues } from '../src/domain/lesson-cues.ts';
import { addLessonMistakes, availableLessonMistakes } from '../src/domain/lesson-mistakes.ts';
import { emptyStudy } from '../src/domain/profile-sync.ts';
const directory = new URL('../materials/en/lessons/ih-bangkok/scientists-and-photography-compliments/', import.meta.url);
const text = (name: string) => readFileSync(new URL(name, directory), 'utf8');
const read = (name: string) => JSON.parse(text(name));

test('November 22 IH preserves all recognized source including silence artifacts and word probabilities', () => {
  const source = read('source-transcript.json');
  const blocks = read('transcript.json');
  assert.equal(source.segments.length, 1063);
  assert.equal(source.durationSeconds, 5359.9);
  assert.equal(source.segments.at(-1).end, 5339.08);
  assert.equal(blocks.at(-1).end, source.durationSeconds);
  assert.deepEqual(blocks.flatMap((b: any) => Array.from({length: b.sourceEnd-b.sourceStart}, (_, i) => b.sourceStart+i)), source.segments.map((s: any) => s.index));
  for (const block of blocks) {
    assert.equal(block.en, source.segments.slice(block.sourceStart, block.sourceEnd).map((s: any) => s.text).join(' '));
    assert.ok(block.ru.length > 80 && block.heading && block.end > block.start);
  }
  assert.ok(source.segments.some((s: any) => s.start === s.end));
  assert.ok(source.segments.every((s: any) => typeof s.no_speech_prob === 'number' && Array.isArray(s.words)));
  for (const file of readdirSync(directory)) {
    assert.ok(!/\.(wav|mp3|m4a|mp4|webm|py)$/i.test(file));
    assert.ok(!/\bDen(?:n)?is(?:e)?\b|Денис|Деннис|\/Users\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|zoom\.us\/j\//iu.test(text(file)), file);
  }
});

test('November 22 IH imports complete six-level dialogues, teacher cards, timed cues and conservative mistake practice', () => {
  const packet = parseChatPackage(text('lesson.json'));
  assert.equal(packet.topic.source?.date, '2026-11-22');
  assert.equal(packet.materials.length, 58);
  assert.equal(packet.words.length, 150);
  const scenes = new Map<string, string[]>();
  for (const row of packet.materials.filter((m: any) => m.kind === 'dialogue')) {
    const version = dialogueVersion(row.title);
    scenes.set(version.title, [...scenes.get(version.title) ?? [], version.level!]);
    assert.ok(row.text.includes('Learner:') && row.translation);
    assert.ok(packet.materials.some((m: any) => m.title === 'Чтение и ответ · '+row.title && m.prompt.includes(row.text) && m.answer));
  }
  assert.equal(scenes.size, 3);
  for (const levels of scenes.values()) assert.deepEqual(levels, ['A1','A2','B1','B2','C1','C2']);
  assert.equal(teacherPhraseCards(packet.materials.find((m: any) => m.title.startsWith('Реплики преподавателя ·'))!.text).length, 44);
  const timed = packet.materials.find((m: any) => m.title === 'Запись урока с таймкодами')!;
  assert.ok(timed.text.startsWith('Recording: lesson-2026-11-22-ih-scientists-photos'));
  assert.equal(lessonCues(timed.text).length, read('transcript.json').length);
  const pack = read('mistake-practice.json');
  const study = applyChatPackage(emptyStudy(), packet).next;
  assert.equal(availableLessonMistakes(study, [pack]).length, 4);
  const seeded = addLessonMistakes(study, [pack], 1800000000000);
  assert.equal(availableLessonMistakes(seeded, [pack]).length, 0);
  assert.equal(addLessonMistakes(seeded, [pack], 1800000000001), seeded);
});
