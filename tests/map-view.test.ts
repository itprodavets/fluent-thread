import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapAnchorLeaves, mapViewKey, validMapView, readMapView, writeMapView } from '../src/domain/map-view.ts';
import { materialLessonHref, materialMapHref, parseMaterialRoute } from '../src/domain/material-route.ts';

test('round trip keeps filters, list/focus pages, zoom and both scroll frames independently per profile and language', () => {
  const records = new Map<string,string>(); const storage = { getItem: (key:string) => records.get(key) ?? null, setItem: (key:string,value:string) => { records.set(key,value); } };
  const key = mapViewKey('denis', 'en');
  const view = { ...validMapView(), query: 'concert', status: 'new' as const, kind: 'dialogue', browsePage: 2, focusId: '["dialogue","lesson","scene"]', focusPage: 1, zoom: 150, overviewOpen: true, scrollY: 950, canvasX: 240, canvasY: 120 };
  writeMapView(storage, key, view);
  assert.deepEqual(readMapView(storage, key), view);
  assert.deepEqual(readMapView(storage, mapViewKey('kseniia','en')), validMapView());
  assert.deepEqual(readMapView(storage, mapViewKey('denis','fr')), validMapView());
  assert.notEqual(mapViewKey('a:b','c'), mapViewKey('a','b:c'));
});
test('malformed, future-version and invalid saved values cannot break map rendering', () => {
  assert.deepEqual(validMapView({ version: 2, query: 'ignore' }), validMapView());
  const value = validMapView({ version: 1, status: 'due', kind: 'skill', zoom: NaN, scrollY: Infinity, canvasX: -5, browsePage: 4.5, focusId: {}, overviewOpen: 'yes' });
  assert.equal(value.status, 'due'); assert.equal(value.kind, 'all'); assert.equal(value.zoom, 100);
  assert.equal(value.scrollY, 0); assert.equal(value.canvasX, 0); assert.equal(value.browsePage, 4); assert.equal(value.focusId, undefined); assert.equal(value.overviewOpen, false);
  assert.deepEqual(readMapView({ getItem: () => '{broken', setItem: () => {} }, 'broken'), validMapView());
});
test('blocked browser storage still retains the same tab view in memory', () => {
  const denied = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('quota'); } };
  const view = { ...validMapView(), status: 'learning' as const, scrollY: 700 };
  assert.doesNotThrow(() => writeMapView(denied, 'denied-test', view));
  assert.deepEqual(readMapView(denied, 'denied-test'), view);
});

test('map practice routes retain exact resource and skill and expose an explicit return marker', () => {
  const route = parseMaterialRoute(materialMapHref('topic:1', 'resource:3', 'skill:2'))!;
  assert.equal(route.topicId, 'topic:1'); assert.equal(route.resourceId, 'resource:3'); assert.equal(route.skillId, 'skill:2'); assert.equal(route.fromMap, true);
  assert.equal(parseMaterialRoute(materialLessonHref('topic:1'))!.fromMap, undefined);
  assert.equal(parseMaterialRoute(materialMapHref('topic:1'))!.fromMap, true);
});

test('opening another tab or downloading never freezes the original map scroll capture', () => {
  const anchor = { hash: '#materials/lesson/topic?from=map', target: '' };
  assert.equal(mapAnchorLeaves({ button: 0 }, anchor), true);
  for (const key of ['ctrlKey','metaKey','shiftKey','altKey']) assert.equal(mapAnchorLeaves({ button: 0, [key]: true }, anchor), false);
  assert.equal(mapAnchorLeaves({ button: 1 }, anchor), false);
  assert.equal(mapAnchorLeaves({ button: 0 }, { ...anchor, target: '_blank' }), false);
  assert.equal(mapAnchorLeaves({ button: 0 }, { ...anchor, download: true }), false);
  assert.equal(mapAnchorLeaves({ button: 0 }, { ...anchor, hash: '#map' }), false);
});
