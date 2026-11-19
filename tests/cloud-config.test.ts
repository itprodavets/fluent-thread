import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCloudConfig, readCloudSelection, saveCloudSelection, profileOwner, cloudConfigKey } from '../src/domain/cloud-config.ts';
const key='sb_publishable_example';
const config={url:'https://project.supabase.co',key};
function memory(){const values=new Map<string,string>();return{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};}
test('custom settings override defaults; reset restores defaults',()=>{
 const storage=memory(); assert.equal(readCloudSelection(storage,config).kind,'default');
 saveCloudSelection(storage,{url:'https://own.supabase.co/',key});
 assert.equal(readCloudSelection(storage,config).config?.url,'https://own.supabase.co');
 saveCloudSelection(storage); assert.equal(readCloudSelection(storage,config).kind,'default');
});
test('secrets and malformed URLs cannot be saved or silently fall back to another database',()=>{
 const storage=memory();
 for(const url of ['http://example.com','https://user:password@example.com','https://example.com/path','https://example.com/?secret=1'])
  assert.throws(()=>normalizeCloudConfig({url,key}));
 for(const key of ['sb_secret_bad',btoa('{}')+'.'+btoa(JSON.stringify({role:'service_role'}))+'.signature','password'])
  assert.throws(()=>saveCloudSelection(storage,{url:config.url,key}));
 storage.setItem(cloudConfigKey,'not json');
 assert.equal(readCloudSelection(storage,config).kind,'invalid');
 assert.equal(readCloudSelection(storage,config).config,undefined);
});
test('the same auth UUID in two projects cannot share caches; URL canonicalization is stable',()=>{
 assert.notEqual(profileOwner(config,'same-id'),profileOwner({url:'https://other.supabase.co',key},'same-id'));
 assert.equal(profileOwner(config,'same-id'),profileOwner({url:'https://PROJECT.supabase.co/',key},'same-id'));
});
