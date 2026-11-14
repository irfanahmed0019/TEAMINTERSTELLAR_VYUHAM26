import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
const url = new URL('./sample-progress.testable.tmp.ts', import.meta.url);
writeFileSync(url, readFileSync(new URL('./sample-progress.ts', import.meta.url), 'utf8').replace('"./loop-types"', '"./loop-types.ts"').replace('"./struggle-engine"', '"./struggle-engine.ts"'));
const { makeSampleProgress } = await import(url.href);
rmSync(url);
test('sample pack retains synthetic provenance and has coherent rich history without owner-verified sessions', () => {
 const s = makeSampleProgress(1900000000000);
 assert.equal(s.sampleProvenance.version, 1);
 assert.equal(s.sessions.length, 12);
 assert.equal(s.plan.missions.length, 6);
 assert.equal(s.struggle.misconceptions.length, 6);
 assert.equal(s.struggle.misconceptions.filter(m=>m.status==='conquered').length,4);
 assert.equal(s.struggle.misconceptions.filter(m=>m.status==='locked').length,2);
 assert.ok(s.struggle.attempts.length>=48);
 assert.ok(s.struggle.misconceptions.every(m=>!m.sourceSessionId && !m.recoveryOwnerId && m.topicTitle.startsWith('DEMO:')));
 assert.ok(s.activity.every(a=>a.text.startsWith('DEMO:')));
 assert.ok(s.sessions.every(a=>a.note.includes('Synthetic')));
 assert.equal(s.struggle.celebratedIds.length,4);
 assert.ok(s.struggle.attempts.every(a=>a.synthetic===true));
 assert.ok(s.struggle.misconceptions.every(a=>a.synthetic===true));
 assert.ok(s.sessions.every(a=>a.synthetic===true));
});
test('sample packs do not share mutable state',()=> {
 const a=makeSampleProgress(1900000000000), b=makeSampleProgress(1900000000000);
 a.sessions.length=0; a.struggle.misconceptions.length=0;
 assert.equal(b.sessions.length,12); assert.equal(b.struggle.misconceptions.length,6);
});
