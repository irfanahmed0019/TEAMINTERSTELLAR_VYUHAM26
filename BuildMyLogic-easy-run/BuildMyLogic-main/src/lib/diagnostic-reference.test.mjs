import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {newReassessment} from './struggle-engine.ts';
const refs=JSON.parse(readFileSync(new URL('./diagnostic-reference.json',import.meta.url),'utf8'));
for(const [topic,languages] of Object.entries(refs)) for(const [language,code] of Object.entries(languages)) {
 test(`diagnostic transfer reference executes correctly: ${topic} / ${language}`,()=>{
  const dir=mkdtempSync(join(tmpdir(),'bml-reference-'));
  try {
   const path=join(dir,language==='c'?'main.c':'main.py');writeFileSync(path,code);
   if(language==='c') {
    const c=spawnSync('gcc',['-std=c11','-Wall','-Werror',path,'-o',join(dir,'main')],{encoding:'utf8'});
    assert.equal(c.status,0,c.stderr);
   }
   for(const check of newReassessment(topic,language,3000,true).tests){
    const run=spawnSync(language==='c'?join(dir,'main'):'python3',language==='c'?[]:[path],{input:check.stdin,encoding:'utf8',timeout:3000});
    assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),check.expected.trim(),check.name);
   }
  } finally {rmSync(dir,{recursive:true,force:true});}
 });
}
