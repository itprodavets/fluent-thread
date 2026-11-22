import type { Study } from './model.ts';
import { neutralLessonRoles } from './material-roles.ts';

export type Value = any;
export type CloudRow = { id: string; value: Value; revision: number };
export type Change = { id: string; value: Value; expected: number };
export type Conflict = { id: string; key: string; local: Value; remote: Value; at: number; scope?: 'learningMapEntry' | 'languageMetadata'; entryKey?: string; metadataPath?: string[] };
export type ProfileDocument = { study: Study; base: Record<string, { value: Value; revision: number }>; cursor: number; conflicts: Conflict[] };
const arrays = new Set(['words', 'topics', 'resources', 'conversationRoutes', 'importedLessons', 'materialArchives']);
const maps = new Set(['languages', 'results', 'topicPackageMaterials', 'ankiImports', 'dialogueMistakes', 'dailySpeech', 'learningSessions', 'dialogueSessions', 'storySessions', 'practiceDays']);
const own = (object: object, key: string) => Object.hasOwn(object, key);
const forbidden = (key: string) => ['__proto__', 'constructor', 'prototype'].includes(key);
export function emptyStudy(): Study {
  return { language: 'en', languages: { en: {} }, words: [], topics: [], resources: [], results: {} };
}
export function equal(a: Value, b: Value) { return a === b || JSON.stringify(a) === JSON.stringify(b); }
export function packStudy(study: Study): Record<string, Value> {
  const entries: [string, Value][] = [];
  for (const [field, value] of Object.entries(study)) {
    if (value === undefined) continue;
    if (arrays.has(field)) {
      entries.push([JSON.stringify(['order', field]), value.length <= 1000 ? value.map((item: {id:string}) => item.id) : []]);
      for (const item of value) entries.push([JSON.stringify([field, item.id]), item]);
    } else if (maps.has(field)) {
      entries.push([JSON.stringify(['map', field]), true]);
      for (const [key, item] of Object.entries(value)) entries.push([JSON.stringify([field, key]), item]);
    } else entries.push([JSON.stringify(['field', field]), value]);
  }
  return Object.fromEntries(entries);
}
export function unpackStudy(records: Record<string, Value>): Study {
  const study: Record<string, Value> = {};
  const orders = new Map<string, string[]>();
  const entries = Object.entries(records).filter(([, value]) => value !== null && value !== undefined);
  for (const [id, value] of entries) {
    const [group, key] = JSON.parse(id);
    if (forbidden(group) || forbidden(key)) continue;
    if (group === 'field') study[key] = value;
    if (group === 'order' && arrays.has(key)) { study[key] = []; orders.set(key, value); }
    if (group === 'map' && maps.has(key)) study[key] = {};
  }
  for (const [id, value] of entries) {
    const [group, key] = JSON.parse(id);
    if (forbidden(group) || forbidden(key)) continue;
    if (arrays.has(group)) (study[group] ??= []).push(value);
    if (maps.has(group)) (study[group] ??= {})[key] = value;
  }
  for (const [group, order] of orders) {
    const positions = new Map(order.map((id, index) => [id, index]));
    study[group].sort((a:{id:string},b:{id:string}) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
  }
  return { ...emptyStudy(), ...study } as Study;
}
// Three-way merge. A remote tombstone wins over a concurrent edit, but the edit is retained as a conflict.
export function mergeValue(base: Value, local: Value, remote: Value, counters = false): { value: Value; conflict: boolean } {
  if (equal(local, base)) return { value: remote, conflict: false };
  if (equal(remote, base)) return { value: local, conflict: false };
  if (counters && [base, local, remote].every(value => typeof value === 'number'))
    return { value: Math.max(0, local + remote - base), conflict: false };
  if (!counters && equal(local, remote)) return { value: local, conflict: false };
  if (counters && base == null && local !== null && remote !== null) {
    if (typeof local === 'number' && typeof remote === 'number') return { value: local + remote, conflict: false };
    if (typeof local === 'object' && typeof remote === 'object') base = {};
  }
  const objects = [base, local, remote].every(value => value && typeof value === 'object' && !Array.isArray(value));
  if (objects) {
    const value: Record<string, Value> = {}; let conflict = false;
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      if (forbidden(key)) continue;
      const merged = mergeValue(base[key], local[key], remote[key], counters);
      if (merged.value !== undefined) value[key] = merged.value;
      conflict ||= merged.conflict;
    }
    return { value, conflict };
  }
  return { value: remote, conflict: true };
}
// Language metadata retains its existing merge semantics. Only the sparse graph
// dictionary treats missing first-creation containers as empty; entries are atomic.
type MetadataAlternative = { metadataPath: string[]; local: Value; remote: Value };
type LanguageMerge = { value: Value; conflict: boolean; scopedMetadata?: boolean; entryConflicts?: { entryKey: string; local: Value; remote: Value }[]; metadataConflicts?: MetadataAlternative[] };
// Mirror ordinary mergeValue conflict boundaries without changing its merge rules.
function metadataAlternatives(base: Value, local: Value, remote: Value, metadataPath: string[] = []): MetadataAlternative[] {
  if (equal(local, base) || equal(remote, base) || equal(local, remote)) return [];
  if ([base, local, remote].every(value => value && typeof value === 'object' && !Array.isArray(value))) {
    return [...new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])]
      .filter(key => !forbidden(key)).flatMap(key => metadataAlternatives(base[key], local[key], remote[key], [...metadataPath, key]));
  }
  return [{ metadataPath, local, remote }];
}
function replaceMetadataPath(current: Value, path: string[], chosen: Value): Value {
  if (!path.length) return chosen;
  const [key, ...rest] = path;
  if (forbidden(key)) return current;
  const next = { ...(current && typeof current === 'object' && !Array.isArray(current) ? current : {}) };
  const value = replaceMetadataPath(next[key], rest, chosen);
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}
function mergeLanguage(base: Value, local: Value, remote: Value): LanguageMerge {
  const object = (value: Value) => value && typeof value === 'object' && !Array.isArray(value);
  if (![local, remote].every(object) || base !== null && base !== undefined && !object(base)) return mergeValue(base, local, remote);
  if (![base, local, remote].some(value => object(value) && own(value, 'learningMap'))) return mergeValue(base, local, remote);
  const withoutOverlay = (value: Value) => {
    if (!object(value)) return value;
    const { learningMap: _overlay, ...metadata } = value;
    return metadata;
  };
  const metadata = mergeValue(withoutOverlay(base), withoutOverlay(local), withoutOverlay(remote));
  const metadataConflicts = metadataAlternatives(withoutOverlay(base), withoutOverlay(local), withoutOverlay(remote));
  const before = base?.learningMap, mine = local.learningMap, theirs = remote.learningMap;
  let overlay: { value: Value; conflict: boolean };
  const entryConflicts: NonNullable<LanguageMerge['entryConflicts']> = [];
  if (equal(mine, before)) overlay = { value: theirs, conflict: false };
  else if (equal(theirs, before) || equal(mine, theirs)) overlay = { value: mine, conflict: false };
  else if ([mine, theirs].every(object) && (before == null || object(before))) {
    const value: Record<string, Value> = {}; let conflict = false;
    for (const key of new Set([...Object.keys(before ?? {}), ...Object.keys(mine), ...Object.keys(theirs)])) {
      if (forbidden(key)) continue;
      const prior = before?.[key], left = mine[key], right = theirs[key];
      let entry: Value;
      if (equal(left, prior)) entry = right;
      else if (equal(right, prior) || equal(left, right)) entry = left;
      else { entry = left === null || right === null ? null : right; entryConflicts.push({ entryKey: key, local: left, remote: right }); }
      if (entry !== undefined) value[key] = entry;
    }
    overlay = { value, conflict };
  } else overlay = mergeValue(before, mine, theirs);
  return { value: { ...metadata.value, ...(overlay.value === undefined ? {} : { learningMap: overlay.value }) }, conflict: metadata.conflict || overlay.conflict, scopedMetadata: !overlay.conflict, entryConflicts, metadataConflicts };
}
export function pendingChanges(document: ProfileDocument): Change[] {
  const records = packStudy(document.study);
  return [...new Set([...Object.keys(records), ...Object.keys(document.base)])].flatMap(id => {
    const value = records[id] ?? null, before = document.base[id];
    return (before ? equal(value, before.value) : value === null) ? [] : [{ id, value, expected: before?.revision ?? 0 }];
  });
}
export function reconcileRows(document: ProfileDocument, rows: CloudRow[], sent?: Map<string, Value>): ProfileDocument {
  const incoming = rows.filter(row => !document.base[row.id] || row.revision > document.base[row.id].revision);
  if (!incoming.length) return document;
  const records = packStudy(document.study);
  const base = { ...document.base }, conflicts = [...document.conflicts];
  let changed = false;
  for (const row of incoming) {
    const before = base[row.id];
    if (before && row.revision <= before.revision) continue;
    const local = own(records, row.id) ? records[row.id] : null;
    const previous = sent?.has(row.id) ? sent.get(row.id) : before?.value ?? null;
    const group = JSON.parse(row.id)[0];
    const languageMerged = group === 'languages' ? mergeLanguage(previous, local, row.value) : undefined;
    const merged = group === 'order' && Array.isArray(local) && Array.isArray(row.value)
      ? { value: [...new Set([...row.value, ...local])], conflict: false }
      : languageMerged ? languageMerged
      : mergeValue(previous, local, row.value, group === 'practiceDays');
    records[row.id] = merged.value;
    base[row.id] = { value: row.value, revision: row.revision };
    if (merged.conflict && !languageMerged?.scopedMetadata) conflicts.push({ id: crypto.randomUUID(), key: row.id,
      local, remote: row.value, at: Date.now() });
    if (languageMerged?.scopedMetadata) for (const alternative of languageMerged.metadataConflicts ?? []) conflicts.push({
      id: crypto.randomUUID(), key: row.id, ...alternative, scope: 'languageMetadata', at: Date.now()
    });
    for (const entry of languageMerged?.entryConflicts ?? []) conflicts.push({
      id: crypto.randomUUID(), key: row.id, ...entry, scope: 'learningMapEntry', at: Date.now()
    });
    changed = true;
  }
  return changed ? { ...document, study: neutralLessonRoles(unpackStudy(records)), base, conflicts } : document;
}
export function reconcileRow(document: ProfileDocument, row: CloudRow, sent?: Value): ProfileDocument {
  return reconcileRows(document, [row], arguments.length >= 3 ? new Map([[row.id, sent]]) : undefined);
}
export function resolveConflict(document: ProfileDocument, id: string, keepLocal: boolean): ProfileDocument {
  const conflict = document.conflicts.find(item => item.id === id);
  if (!conflict) return document;
  const records = packStudy(document.study);
  if (conflict.scope && JSON.parse(conflict.key)[0] === 'languages') {
    const current = records[conflict.key] ?? {};
    const chosen = keepLocal ? conflict.local : conflict.remote;
    if (conflict.scope === 'learningMapEntry' && conflict.entryKey !== undefined && !forbidden(conflict.entryKey)) {
      const overlay = { ...current.learningMap };
      if (chosen === undefined) delete overlay[conflict.entryKey];
      else overlay[conflict.entryKey] = chosen;
      records[conflict.key] = { ...current, learningMap: overlay };
    } else if (conflict.scope === 'languageMetadata') {
      const { learningMap: _overlay, ...metadata } = current;
      const resolved = replaceMetadataPath(metadata, conflict.metadataPath ?? [], chosen);
      records[conflict.key] = { ...resolved, ...(own(current, 'learningMap') ? { learningMap: current.learningMap } : {}) };
    }
    return { ...document, study: unpackStudy(records), conflicts: document.conflicts.filter(item => item.id !== id) };
  }
  if (keepLocal) records[conflict.key] = conflict.local;
  return { ...document, study: keepLocal ? unpackStudy(records) : document.study, conflicts: document.conflicts.filter(item => item.id !== id) };
}
