import { ownedDatabase } from './profile-local.ts';
type Entry = { key: IDBValidKey; value: unknown };
function open(name: string, store: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => request.result.createObjectStore(store);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (request.result.objectStoreNames.contains(store)) resolve(request.result);
      else { request.result.close(); reject(new Error('Не удалось прочитать локальные записи.')); }
    };
  });
}
function batch(db: IDBDatabase, store: string, after?: IDBValidKey) {
  return new Promise<Entry[]>((resolve, reject) => {
    const rows: Entry[] = [];
    const tx = db.transaction(store);
    const request = tx.objectStore(store).openCursor(after === undefined ? undefined : IDBKeyRange.lowerBound(after, true));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      rows.push({ key: cursor.key, value: cursor.value });
      if (rows.length < 200) cursor.continue();
    };
    tx.oncomplete = () => resolve(rows);
    tx.onabort = () => reject(tx.error);
  });
}
function mergeHistory(source: unknown, target: unknown) {
  if (!Array.isArray(source) || (target !== undefined && !Array.isArray(target))) throw new Error('Неподдерживаемая история Anki.');
  const entries = new Map<string, unknown>();
  // Keep newer edits already present in the signed-in profile when an event ID occurs in both stores.
  for (const event of [...source, ...(target ?? [])]) entries.set(JSON.stringify([event[0], event[1]]), event);
  return [...entries.values()];
}
async function copy(sourceName: string, targetName: string, store: string, history: boolean) {
  const source = await open(sourceName, store);
  let target: IDBDatabase | undefined;
  try {
    target = await open(targetName, store);
    let after: IDBValidKey | undefined, count = 0;
    for (;;) {
      const rows = await batch(source, store, after);
      if (!rows.length) return count;
      await new Promise<void>((resolve, reject) => {
        const tx = target!.transaction(store, 'readwrite');
        const entries = tx.objectStore(store);
        let failure: unknown;
        for (const row of rows) {
          const request = entries.get(row.key);
          request.onsuccess = () => {
            try {
              if (history) entries.put(mergeHistory(row.value, request.result), row.key);
              else if (request.result === undefined) entries.put(row.value, row.key);
            } catch (error) { failure = error; tx.abort(); }
          };
        }
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(failure ?? tx.error);
      });
      count += rows.length;
      after = rows.at(-1)!.key;
    }
  } finally { source.close(); target?.close(); }
}
// Both stores stay on this device. The explicit owner is captured before any async work/account switch.
export async function copyGuestLocalData(owner: string) {
  if (!owner || owner === 'guest') throw new Error('Сначала войди в нужный профиль.');
  const historyNotes = await copy('nit-rechi-anki', ownedDatabase('nit-rechi-anki', owner), 'notes', true);
  const recordings = await copy('nit-rechi-audio', ownedDatabase('nit-rechi-audio', owner), 'takes', false);
  return { historyNotes, recordings };
}
