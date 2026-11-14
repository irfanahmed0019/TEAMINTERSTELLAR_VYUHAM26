import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateWithPassword, passwordSignInError } from './email-auth.ts';
test('email login only calls existing provider password sign-in and preserves password bytes',async()=>{
 let sent;const client={auth:{signInWithPassword:async input=>(sent=input,{data:{session:{user:{id:'test'}}},error:null})}};
 await authenticateWithPassword(client,'  learner@example.invalid  ',' local-test-only ');
 assert.deepEqual(sent,{email:'learner@example.invalid',password:' local-test-only '});
});
test('provider failures do not expose reflected secrets or account existence',async()=>{
 const client={auth:{signInWithPassword:async()=>({data:{session:null},error:{code:'invalid_credentials',message:'PRIVATE REFLECTED CONTENT'}})}};
 await assert.rejects(authenticateWithPassword(client,'a@example.invalid','local-only'),e=>!e.message.includes('PRIVATE')&&e.message===passwordSignInError());
});
test('missing configuration never creates fake local login',async()=>{
 await assert.rejects(authenticateWithPassword(null,'a@example.invalid','local-only'),/not configured/);
});
test('network and empty-session failures are explicit',async()=>{
 await assert.rejects(authenticateWithPassword({auth:{signInWithPassword:async()=>{throw Error('private');}}},'a@example.invalid','local-only'),/connection/);
 await assert.rejects(authenticateWithPassword({auth:{signInWithPassword:async()=>({data:{session:null},error:null})}},'a@example.invalid','local-only'),/did not finish/);
});
test('confirmation and rate limiting errors are actionable without signup or reset',()=>{
 assert.match(passwordSignInError('email_not_confirmed'),/Confirm your email/);
 assert.match(passwordSignInError('over_request_rate_limit'),/Wait/);
});
