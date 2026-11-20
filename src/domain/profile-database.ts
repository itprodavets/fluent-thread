import type { StoredProfile } from './profile-store';
let database: Promise<IDBDatabase> | undefined;
export function openProfiles() {
  return database ??= new Promise((resolve,reject) => {
    const request=indexedDB.open('nit-rechi-profiles',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('profiles');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{database=undefined;reject(request.error);};
  });
}
// IndexedDB serializes read/write transactions across tabs. Apply intent to the latest
// committed document, never overwrite it with a snapshot loaded by an older tab.
export async function transactProfile(id: string, previous: StoredProfile, change: (doc: StoredProfile)=>StoredProfile, onWrite?: ()=>void) {
  const db=await openProfiles();
  return new Promise<StoredProfile>((resolve,reject)=>{
    const tx=db.transaction('profiles','readwrite');
    const entries=tx.objectStore('profiles');
    const request=entries.get(id);
    let next:StoredProfile, failure:unknown, written=false;
    request.onsuccess=()=>{
      try {
        const saved:StoredProfile=request.result ?? previous;
        // Cursor-only advances have no unsaved content; base revisions make replay safe.
        const latest=previous.cursor>saved.cursor ? {...saved,cursor:previous.cursor} : saved;
        next=change(latest);
        const keys=Object.keys({...latest,...next}) as (keyof StoredProfile)[];
        if(keys.some(key=>key!=='cursor' && next[key]!==latest[key])) { entries.put(next,id);written=true; }
      } catch(error) {failure=error;tx.abort();}
    };
    tx.oncomplete=()=>{
      if(written) { try { onWrite?.(); } catch { /* A closed notification channel cannot undo a committed save. */ } }
      resolve(next);
    };
    tx.onabort=()=>reject(failure??tx.error);
  });
}
