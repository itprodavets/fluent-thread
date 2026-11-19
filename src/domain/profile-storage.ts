import { prepareStudy, readStudy } from './study-storage';
import { emptyStudy } from './profile-sync';
import type { StoredProfile } from './profile-store';
let database: Promise<IDBDatabase> | undefined;
export { setLocalOwner } from './profile-local';
function openProfiles() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('nit-rechi-profiles', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('profiles');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
  });
}
export async function loadProfile(id: string): Promise<StoredProfile> {
  const db = await openProfiles();
  const saved = await new Promise<StoredProfile | undefined>((resolve, reject) => {
    const request = db.transaction('profiles').objectStore('profiles').get(id);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  if (saved) return { ...saved, study: prepareStudy(saved.study) };
  const study = id === 'guest' ? await readStudy() : emptyStudy();
  return { study, base: {}, cursor: 0, conflicts: [] };
}
export async function saveProfile(id: string, value: StoredProfile) {
  const db = await openProfiles();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('profiles', 'readwrite');
    tx.objectStore('profiles').put(value, id);
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
}
