import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lessonCues } from '../src/domain/lesson-cues.ts';
import { lineAtTime, recordingTime } from '../src/domain/lesson-transcript.ts';
import type { TranscriptLine } from '../src/domain/lesson-transcript.ts';

test('transcript follows playback across overlaps, gaps and hour boundaries', () => {
  const lines: TranscriptLine[] = [
    { start: 3598, end: 3602, en: 'First', ru: 'Первый' },
    { start: 3600, end: 3603, en: 'Second', ru: 'Второй' },
    { start: 3606, end: 3612, en: 'Third', ru: 'Третий' }
  ];
  assert.equal(lineAtTime(lines, 3597.5), -1);
  assert.equal(lineAtTime(lines, 3599), 0);
  assert.equal(lineAtTime(lines, 3600), 1);
  assert.equal(lineAtTime(lines, 3603), -1);
  assert.equal(lineAtTime(lines, 3606), 2);
  assert.equal(recordingTime(3606.81), '01:00:06');
});

test('November 17 transcript covers the teaching sections on both sides of the break', () => {
  const path = new URL('../materials/2026-11-17/', import.meta.url);
  const lines: TranscriptLine[] = JSON.parse(readFileSync(new URL('transcript.json', path), 'utf8'));
  const packet = JSON.parse(readFileSync(new URL('dcpl-conversation.json', path), 'utf8'));
  const audio = packet.materials.find((item: { title: string }) => item.title === 'Запись урока с таймкодами');
  const chapters = lessonCues(audio.text);
  assert.ok(lines.length > 1400);
  assert.ok(lines.every((line, index) => line.end > line.start && line.en && line.ru
    && (index === 0 || line.start >= lines[index - 1].start)));
  assert.equal(chapters.filter(cue => !lines.some(line => line.start < cue.end && line.end > cue.start)).length, 1);
  assert.ok(lines.some(line => line.teacher && line.en.includes('entirely up to you')));
  assert.ok(lines.some(line => line.teacher && line.en.includes('Acquired knowledge')));
});
