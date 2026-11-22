import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectTopics, disconnectTopics, moveTopic, topicEdges, topicPositions, withinCanvas } from '../src/domain/topic-graph.ts';
import type { Study, Topic } from '../src/domain/model.ts';

function fixture(): Study {
  const topic = (id: string, language = 'en'): Topic => ({ id, language, title: id, prompt: 'Speak', links: ['word'], materials: [{ format: 'dialogue', text: 'Original' }] });
  return { language: 'en', languages: { en: {}, zh: {} }, topics: [topic('a'), topic('b'), topic('c', 'zh')],
    words: [{ id: 'word', language: 'en', title: 'word', meaning: '', example: '' }], resources: [],
    results: { a: { level: 3, result: 'independent', due: 999999, attempts: 4, updated: 123 } } };
}

test('connect prevents duplicates, self-links, unknown topics and cross-language links', () => {
  const original = fixture();
  for (const [from, to] of [['a', 'a'], ['a', 'missing'], ['missing', 'a'], ['a', 'c']]) {
    assert.equal(connectTopics(original, from, to), original);
  }
  const linked = connectTopics(original, 'a', 'b');
  assert.deepEqual(topicEdges(linked.topics), [{ from: 'a', to: 'b' }]);
  assert.equal(connectTopics(linked, 'a', 'b'), linked);
  assert.equal(connectTopics(linked, 'b', 'a'), linked);
  assert.equal(linked.topics[1], original.topics[1]);
  assert.equal(linked.results, original.results);
  assert.deepEqual(original.topics[0].connections, undefined);
});

test('moving clamps the final position and preserves all study content and review dates', () => {
  const original = fixture();
  const changed = moveTopic(original, 'a', { x: -500, y: 500 });
  assert.deepEqual(changed.topics[0].position, { x: 21, y: 93 });
  assert.equal(changed.topics[0].materials, original.topics[0].materials);
  assert.equal(changed.topics[0].links, original.topics[0].links);
  for (const key of ['words', 'resources', 'results', 'languages'] as const) assert.equal(changed[key], original[key]);
  assert.equal(changed.topics[2], original.topics[2]);
  assert.deepEqual(withinCanvas({ x: 500, y: -500 }), { x: 79, y: 7 });
  assert.equal(original.topics[0].position, undefined);
});

test('legacy reciprocal edges deduplicate and disconnect removes both directions only', () => {
  const original = fixture();
  original.topics[0].connections = ['b', 'b', 'missing', 'a', 'c'];
  original.topics[1].connections = ['a'];
  assert.deepEqual(topicEdges(original.topics), [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }]);
  const changed = disconnectTopics(original, 'b', 'a');
  assert.deepEqual(changed.topics[0].connections, ['missing', 'a', 'c']);
  assert.deepEqual(changed.topics[1].connections, []);
  assert.equal(changed.topics[2], original.topics[2]);
});

test('search presentation can omit nodes without modifying positions or stored connections', () => {
  const original = connectTopics(fixture(), 'a', 'b');
  original.topics[0].position = { x: 38, y: 42 };
  const positions = topicPositions(original.topics);
  const visible = original.topics.filter(topic => topic.title === 'a');
  assert.equal(visible.length, 1);
  assert.deepEqual(positions.get('a'), { x: 38, y: 42 });
  assert.deepEqual(original.topics[0].connections, ['b']);
  assert.deepEqual(topicEdges(original.topics), [{ from: 'a', to: 'b' }]);
  assert.equal(positions.size, 3);
});
