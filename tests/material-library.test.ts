import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materialLibraryPage } from '../src/domain/material-library.ts';
import type { Resource } from '../src/domain/model.ts';
const resources: Resource[] = Array.from({length: 35}, (_, i) => ({ id: String(i), title: String(i), language: 'en', topicId: i % 2 ? 'a' : undefined, kind: 'reading', text: 'Full original text', answer: '', prompt: '', url: '' }));
test('all library materials remain reachable across bounded pages with their full content', () => {
  const before = structuredClone(resources);
  const all = [0,1,2].flatMap(page => materialLibraryPage(resources, '', page).items);
  assert.deepEqual(all, resources); assert.deepEqual(resources, before);
  assert.equal(materialLibraryPage(resources, '', 0).items.length, 12);
});
test('direct resource opens its page; filters and deletions clamp stale pagination', () => {
  assert.equal(materialLibraryPage(resources, '', 0, '30').page, 2);
  assert.ok(materialLibraryPage(resources, '', 0, '30').items.some(item => item.id === '30'));
  assert.equal(materialLibraryPage(resources, 'a', 99).page, 1);
  assert.ok(materialLibraryPage(resources, 'unassigned', 0).items.every(item => !item.topicId));
  assert.deepEqual(materialLibraryPage([], '', 3, 'gone'), {items: [], page: 0, pages: 1, total: 0});
});
