import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passwordProblem, passwordLogin, setProfilePassword, resetProfilePassword } from '../src/domain/password-auth.ts';

test('new passwords require twelve characters and an exact matching confirmation',()=>{
  assert.ok(passwordProblem('short','short'));
  assert.ok(passwordProblem('twelve-or-more','different-value'));
  assert.equal(passwordProblem('  unique password  ','  unique password  '),undefined);
});
test('password login preserves significant password whitespace and trims only the email',async()=>{
  let actual:unknown;
  const result=await passwordLogin({signInWithPassword:async value=>{actual=value;return{error:null};}},' learner@example.com ','  correct password  ');
  assert.equal(result.error,undefined);
  assert.deepEqual(actual,{email:'learner@example.com',password:'  correct password  '});
});
test('setting a password validates before sending and passes a current password only when supplied',async()=>{
  const calls:unknown[]=[];
  const auth={updateUser:async(value:unknown)=>{calls.push(value);return{error:null};}};
  assert.ok((await setProfilePassword(auth,'short','short')).error);
  assert.equal(calls.length,0);
  assert.equal((await setProfilePassword(auth,'long new password','long new password',' current ')).error,undefined);
  assert.deepEqual(calls,[{password:'long new password',current_password:' current '}]);
});
test('login and recovery hide provider internals and recovery does not disclose account existence',async()=>{
  const failed=await passwordLogin({signInWithPassword:async()=>({error:{code:'invalid_credentials',message:'private provider response'}})},'learner@example.com','guess');
  assert.ok(failed.error);assert.equal(failed.error?.includes('private'),false);
  const recover=await resetProfilePassword({resetPasswordForEmail:async()=>({error:null})},'learner@example.com','https://example.com/#profile');
  assert.equal(recover.error,undefined);
  const offline=await passwordLogin({signInWithPassword:async()=>{throw new Error('secret transport details');}},'learner@example.com','guess');
  assert.ok(offline.error);assert.equal(offline.error?.includes('secret'),false);
});

test('recovery does not distinguish an unknown account and preserves rate-limit errors',async()=>{
  const unknown=await resetProfilePassword({resetPasswordForEmail:async()=>({error:{code:'user_not_found'}})},'unknown@example.com','https://example.com/#profile');
  assert.equal(unknown.error,undefined);
  const limited=await resetProfilePassword({resetPasswordForEmail:async()=>({error:{code:'over_email_send_rate_limit'}})},'learner@example.com','https://example.com/#profile');
  assert.ok(limited.error);
});
