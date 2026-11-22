import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseChatPackage, applyChatPackage } from '../src/domain/chat-package.js';
import { dialogueVersion } from '../src/domain/imported-lessons.ts';
import { teacherPhraseCards } from '../src/domain/lesson-practice.ts';
import { assess } from '../src/domain/model.ts';
import { lessonCues } from '../src/domain/lesson-cues.ts';
import { emptyStudy, packStudy, unpackStudy } from '../src/domain/profile-sync.ts';
import { addLessonMistakes, availableLessonMistakes } from '../src/domain/lesson-mistakes.ts';
const cases = [
  { id: 'uuca-esol/food-traditions-and-sharing-a-project', count: 2960, duration: 6482.46, key: 'lesson-2026-11-21-uuca-food-project' },
];
const file = (id: string, name: string) => new URL('../materials/en/lessons/' + id + '/' + name, import.meta.url);
const read = (id: string, name: string) => JSON.parse(readFileSync(file(id, name), 'utf8'));

test('new Vibe lessons retain all recognized positions, explicit limitations and usable six-level text practice', () => {
  const catalog = JSON.parse(readFileSync(new URL('../materials/en/lessons/catalog.json', import.meta.url), 'utf8'));
  for (const item of cases) {
    const source = read(item.id, 'source-transcript.json'), blocks = read(item.id, 'transcript.json');
    assert.equal(source.segments.length, item.count);
    assert.equal(source.durationSeconds, item.duration);
    assert.deepEqual(blocks.flatMap((b: any) => Array.from({ length: b.sourceEnd - b.sourceStart }, (_, i) => b.sourceStart + i)), source.segments.map((s: any) => s.index));
    for (const block of blocks) {
      assert.equal(block.en, source.segments.slice(block.sourceStart, block.sourceEnd).map((s: any) => s.text).join(' '));
      assert.ok(block.ru.length > 40 && block.heading && block.end > block.start);
    }
    assert.equal(blocks.at(-1).end, item.duration);
    const text = readFileSync(file(item.id, 'lesson.json'), 'utf8'), packet = parseChatPackage(text);
    assert.ok(catalog.some((entry: any) => entry.id === item.id && entry.topic === packet.topic.title));
    assert.ok(packet.words.length >= 70 && packet.words.every((w: any) => w.vocabularyLevel === 'learning'));
    const scenes = new Map<string, string[]>();
    for (const material of packet.materials.filter((r: any) => r.kind === 'dialogue')) {
      const { title, level } = dialogueVersion(material.title);
      scenes.set(title, [...(scenes.get(title) ?? []), level!]);
      assert.ok(material.translation && material.text.includes('Learner:') && material.text.split('\n').length >= 4);
      assert.ok(packet.materials.some((r: any) => r.title === 'Чтение и ответ · ' + material.title && r.prompt.includes(material.text) && r.answer));
    }
    assert.ok(scenes.size >= 3);
    for (const levels of scenes.values()) assert.deepEqual(levels, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) assert.ok(packet.materials.some((r: any) => r.kind === 'reading' && r.title.endsWith(' · ' + level) && r.translation));
    assert.ok(teacherPhraseCards(packet.materials.find((r: any) => r.title.startsWith('Реплики преподавателя ·'))!.text).length >= 20);
    const cues = packet.materials.find((r: any) => r.title === 'Запись урока с таймкодами')!;
    assert.ok(cues.text.startsWith('Recording: ' + item.key + '\n'));
    assert.equal(lessonCues(cues.text).length, blocks.length);
    for (const name of readdirSync(new URL('.', file(item.id, 'lesson.json')))) {
      assert.ok(!/\.(wav|mp3|m4a|mp4|webm)$/i.test(name));
      const content = readFileSync(file(item.id, name), 'utf8');
      assert.ok(!/\bDen(?:n)?is(?:e)?\b|Денис|Деннис|\/Users\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|zoom\.us\/j\//iu.test(content), item.id + '/' + name);
    }
  }
});

test('adding new contextual corrections and reimporting a lesson preserve existing learning results and review dates', () => {
  let study = emptyStudy();
  const packet = parseChatPackage(readFileSync(file(cases[0].id, 'lesson.json'), 'utf8'));
  study = applyChatPackage(study, packet).next;
  const word = study.words[0];
  study = assess(study, word.id, 'independent', 1800000000000, 'spoken');
  const result = study.results[word.id];
  const packs = cases.map(item => read(item.id, 'mistake-practice.json'));
  const seeded = addLessonMistakes(study, packs, 1800000000000);
  assert.equal(availableLessonMistakes(seeded, packs).length, 0);
  assert.equal(seeded.results[word.id], result);
  assert.equal(addLessonMistakes(seeded, packs, 1800000001000), seeded);
  const importedAgain = applyChatPackage(seeded, packet).next;
  assert.deepEqual(importedAgain.results, seeded.results);
  assert.deepEqual(importedAgain.dialogueMistakes, seeded.dialogueMistakes);
  assert.deepEqual(unpackStudy(packStudy(importedAgain)), importedAgain);
});
