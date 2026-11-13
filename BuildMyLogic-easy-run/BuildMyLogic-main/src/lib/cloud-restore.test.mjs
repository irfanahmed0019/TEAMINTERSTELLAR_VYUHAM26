import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCloudRead,restoreCloudState} from './cloud-restore.ts';

for(const [name,error] of [['permission',{code:'42501'}],['network',new Error('offline')],['server',{status:500}]]) {
 test(`${name} cloud error must not look like an absent row`,()=>{
  assert.throws(()=>parseCloudRead({data:null,error}),/Saving is paused/);
 });
}
test('an existing row plus an error is not trusted',()=>assert.throws(()=>parseCloudRead({data:{state_json:{plan:'real'}},error:{code:403}})));
test('only successful no-row returns null',()=>assert.equal(parseCloudRead({data:null,error:null}),null));
for(const value of [null,undefined,'bad',[],false]) test(`invalid stored state ${String(value)} fails closed`,()=>assert.throws(()=>parseCloudRead({data:{state_json:value},error:null})));
test('successful saved state preserves full returned JSON',()=>{
 const state={struggle:{diagnosis:{choice:0}},unknownFutureField:{keep:true}};
 assert.equal(parseCloudRead({data:{state_json:state},error:null}),state);
});
function setup(read,current=()=>true){
 let local={history:['local']};const applied=[];
 return {applied,get local(){return local;},options:{read,current,normalize:x=>({...x,normalized:true}),local:()=>local,apply:x=>{local=x;applied.push(x);}}};
}
test('read failure preserves local state without applying or yielding a save baseline',async()=>{
 const s=setup(async()=>{throw new Error('network');});
 await assert.rejects(restoreCloudState(s.options),/network/);assert.deepEqual(s.local,{history:['local']});assert.deepEqual(s.applied,[]);
});
test('normalization is local and no restore write callback exists',async()=>{
 const cloud={history:['real'],unknown:'keep'};const s=setup(async()=>cloud);
 const baseline=await restoreCloudState(s.options);assert.equal(baseline,JSON.stringify(s.local));assert.deepEqual(s.local,{...cloud,normalized:true});assert.deepEqual(cloud,{history:['real'],unknown:'keep'});
});
test('successful absence establishes local baseline but never applies/uploads',async()=>{
 const s=setup(async()=>null);assert.equal(await restoreCloudState(s.options),JSON.stringify(s.local));assert.deepEqual(s.applied,[]);
});
test('late read after identity change is ignored',async()=>{
 const s=setup(async()=>({history:['old-owner']}),()=>false);assert.equal(await restoreCloudState(s.options),null);assert.deepEqual(s.applied,[]);assert.deepEqual(s.local,{history:['local']});
});
test('successful retry can restore after error without losing prior state',async()=>{
 let fail=true;const s=setup(async()=>{if(fail)throw new Error('offline');return {history:['cloud']};});
 await assert.rejects(restoreCloudState(s.options));fail=false;await restoreCloudState(s.options);assert.deepEqual(s.local,{history:['cloud'],normalized:true});
});
