import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
// No external database or AI call is allowed in this isolated unit test.
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SARVAM_API_KEY;
const temp=new URL('./session-history.testable.tmp.ts',import.meta.url);
const source=readFileSync(new URL('./learning-sessions.server.ts',import.meta.url),'utf8');
writeFileSync(temp,source.replace('import { sarvamJson } from "./sarvam.server";', 'const sarvamJson = async <T>(..._args: unknown[]): Promise<T> => { throw new Error("AI must not be called by this test"); };'));
process.on('exit',()=>rmSync(temp,{force:true}));
const {startLearningSession,recordEvent,stateOf}=await import(temp.href);
test('session state exposes original numbered test attempts, not synthesized checkpoint history',async()=>{
 const session=await startLearningSession({challenge_id:'isolated-history-test',concept:'loops',language:'python',checkpoints:[{title:'Loops',detail:'Check a loop'}]});
 recordEvent(session,'test_result',{passed:0,total:1,checkpoint_results:[{index:0,passed:false,output:'expected 5, got 4'}]});
 recordEvent(session,'heartbeat',{});
 recordEvent(session,'test_result',{passed:0,total:1,checkpoint_results:[{index:0,passed:false,output:'expected 5, got 4 again'}]});
 const history=stateOf(session).attempt_history;
 assert.equal(history.length,2);assert.deepEqual(history.map(a=>a.attempt),[1,2]);
 assert.equal(history[0].checkpoints[0].lastOutput,'expected 5, got 4');
 assert.equal(history[1].checkpoints[0].lastOutput,'expected 5, got 4 again');
 assert.ok(history.every(a=>Number.isFinite(a.at)));
});
