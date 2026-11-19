import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { copyGuestLocalData } from '../src/domain/profile-local-migration.ts';
import { ownedDatabase, setLocalOwner } from '../src/domain/profile-local.ts';
async function database(name:string,store:string) {
 return await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore(store);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
async function put(name:string,store:string,key:string,value:any){const db=await database(name,store);try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
async function get(name:string,store:string,key:string){const db=await database(name,store);try{return await new Promise<any>((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
test('profile transfer preserves guest history and recordings, target updates and owner isolation on retry',async()=>{
 const owner='https://example.supabase.co:denis',other='https://example.supabase.co:kseniia';
 const source='nit-rechi-anki',target=ownedDatabase(source,owner),note='["en","note"]';
 await put(source,'notes',note,[[100,1,1,0],[200,2,2,1]]);
 await put(target,'notes',note,[[100,1,4,30],[300,3,3,3]]);
 await put('nit-rechi-audio','takes','old-take',new Blob(['old recording']));
 await put('nit-rechi-audio','takes','current-take',new Blob(['old version']));
 await put(ownedDatabase('nit-rechi-audio',owner),'takes','current-take',new Blob(['current version']));
 for(let i=0;i<230;i++) await put(source,'notes','note-'+String(i).padStart(3,'0'),[[i,i,3,1]]);
 setLocalOwner(other); // An account switch cannot redirect the explicitly requested target.
 await copyGuestLocalData(owner);
 await copyGuestLocalData(owner);
 assert.deepEqual(await get(target,'notes','note-229'),[[229,229,3,1]]);
 const reviews=await get(target,'notes',note);
 assert.equal(reviews.length,3);
 assert.deepEqual(reviews.find((r:number[])=>r[1]===1),[100,1,4,30]);
 assert.equal((await get(source,'notes',note)).length,2);
 assert.equal(await (await get(ownedDatabase('nit-rechi-audio',owner),'takes','old-take')).text(),'old recording');
 assert.equal(await (await get(ownedDatabase('nit-rechi-audio',owner),'takes','current-take')).text(),'current version');
 assert.equal(await get(ownedDatabase(source,other),'notes',note),undefined);
 await assert.rejects(copyGuestLocalData('guest'));
});
