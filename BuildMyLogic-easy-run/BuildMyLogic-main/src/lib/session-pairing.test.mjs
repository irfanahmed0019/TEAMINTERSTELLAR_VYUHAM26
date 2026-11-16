import test from 'node:test';
import assert from 'node:assert/strict';
import {createPairingCode,claimPairingCode,normalizePairingCode} from './session-pairing.server.ts';
import {createHash} from 'node:crypto';
const token='A'.repeat(43),owner='23c2544f-3ff9-4ab9-ba41-0fb79928120c';
test('pairing canonical alphabet and separators reject public IDs and whitespace injection',()=>{
 assert.equal(normalizePairingCode('abcd-ef23'),'ABCDEF23');
 assert.equal(normalizePairingCode('ABCD EF23'),'ABCDEF23');
 for(const bad of ['BML-ABCDE','ABCD-EF01','ABCD-EFIO','ABCD\nEF23','\tABCDEF23',null,{},'A'.repeat(500)])assert.equal(normalizePairingCode(bad),null);
});
test('actual storage module persists only code hash/encrypted token; concurrent claim single winner, replay empty',async()=>{
 const old=global.fetch;process.env.VITE_SUPABASE_URL='https://db.example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key-never-network';
 const rows=new Map();let stored;
 global.fetch=async (input,opts)=>{
  const url=new URL(input);assert.equal(url.hostname,'db.example.invalid');
  if(opts.method==='POST'){stored=JSON.parse(opts.body);rows.set(stored.code_hash,stored);return new Response('',{status:201});}
  assert.equal(opts.method,'DELETE');assert.equal(opts.headers.prefer,'return=representation');
  const hash=url.searchParams.get('code_hash').slice(3),row=rows.get(hash);rows.delete(hash);
  return Response.json(row&&row.expires_at>url.searchParams.get('expires_at').slice(3)?[row]:[]);
 };
 try{
  const issued=await createPairingCode('BML-ABCDE',owner,token);
  assert.match(issued.code,/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.ok(!JSON.stringify(stored).includes(token));assert.ok(!JSON.stringify(stored).includes(issued.code));
  const results=await Promise.all([claimPairingCode(issued.code),claimPairingCode(issued.code)]);
  assert.equal(results.filter(Boolean).length,1);assert.equal(results.find(Boolean).connection_token,token);
  assert.equal(await claimPairingCode(issued.code),null);
  const expired=await createPairingCode('BML-ABCDE',owner,token,Date.now()-600000);
  assert.equal(await claimPairingCode(expired.code),null);
  const tampered=await createPairingCode('BML-ABCDE',owner,token);stored.owner_id='wrong-owner';
  await assert.rejects(claimPairingCode(tampered.code));
 }finally{global.fetch=old;delete process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.VITE_SUPABASE_URL;}
});
test('storage unavailable cannot mint or claim a usable code',async()=>{
 const old=global.fetch;process.env.VITE_SUPABASE_URL='https://db.example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic';global.fetch=async()=>new Response('',{status:503});
 try{await assert.rejects(createPairingCode('BML-ABCDE',owner,token));await assert.rejects(claimPairingCode('ABCDEF23'));}finally{global.fetch=old;delete process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.VITE_SUPABASE_URL;}
});
