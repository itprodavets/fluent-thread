import type { TranscriptLine } from './lesson-transcript';

export const transcriptLoaders: Partial<Record<string, () => Promise<{ default: TranscriptLine[] }>>> = {
  'lesson-2026-11-17': () => import('../../materials/2026-11-17/transcript.json'),
  'lesson-2026-11-17-teaching-house': () => import('../../materials/2026-11-17/teaching-house-transcript.json')
};

export function lessonRecording(key: string, file?: File): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('nit-rechi-lesson-audio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('recordings');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('recordings', file ? 'readwrite' : 'readonly');
      const store = tx.objectStore('recordings');
      const result = file ? store.put(file, key) : store.get(key);
      tx.oncomplete = () => { db.close(); resolve(file ?? result.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}
