import { prepareStudy, readStudy } from './study-storage';
import { emptyStudy } from './profile-sync';
import type { StoredProfile } from './profile-store';
import { openProfiles } from './profile-database';
export { transactProfile } from './profile-database';
export { setLocalOwner } from './profile-local';
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
