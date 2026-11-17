import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { IDLE_WINDOW_MS, sessionActivityClock } from './sessionActivity.ts';
const base={now:100000,activityAt:100000,consent:true,focused:true,paused:false,finished:false};
test('AFK displays the existing 30-second cap exactly, without changing evidence',()=>{
 assert.equal(IDLE_WINDOW_MS,30000);
 assert.equal(sessionActivityClock(base).seconds,30);
 assert.equal(sessionActivityClock({...base,now:129999}).seconds,1);
 assert.equal(sessionActivityClock({...base,now:130000}).state,'afk');
 for (const patch of [{focused:false},{paused:true},{finished:true},{consent:false},{activityAt:0}]) assert.notEqual(sessionActivityClock({...base,...patch}).state,'active');
 assert.equal(sessionActivityClock({...base,now:140000,activityAt:140000}).seconds,30);
});
test('actual extension listener stays consented, foreground, task-local and sends no insertion/source event',async()=>{
 const compiled=await build({stdin:{contents:readFileSync('src/extension.ts','utf8')+'\nexport {Sidebar};',resolveDir:process.cwd()+'/src',loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,external:['vscode']});
 const listeners={},messages=[],events=[];
 const disposable={dispose(){}};
 const vs={window:{state:{focused:true},onDidChangeWindowState(fn){listeners.focus=fn;return disposable;}},workspace:{workspaceFolders:[{uri:{fsPath:'/qa/project'}}],asRelativePath:()=> 'main.py',onDidChangeTextDocument(fn){listeners.change=fn;return disposable;},onDidSaveTextDocument(){return disposable;}},languages:{onDidChangeDiagnostics(){return disposable;}}};
 const mod={exports:{}};const real=createRequire(import.meta.url);
 new Function('module','exports','require',compiled.outputFiles[0].text)(mod,mod.exports,id=>id==='vscode'?vs:real(id));
 const sidebar=new mod.exports.Sidebar({event:async(...e)=>{events.push(e);return {ok:true};}},{update(){}},{});
 sidebar.view={webview:{postMessage:m=>messages.push(m)}};
 sidebar.connection={sessionId:'BML-QA123'};sidebar.session={session_id:'BML-QA123',challenge_id:'one',task_generation:0,status:'connected'};sidebar.evidenceConsent=true;
 const event={document:{uri:{scheme:'file',fsPath:'/qa/project/main.py'},languageId:'python'},contentChanges:[{text:'x'.repeat(500)}]};
 try {
  sidebar.post({session:sidebar.session});sidebar.installEvidenceSubscriptions();
  listeners.change(event);
  assert.equal(messages.at(-1).clock.seconds,30);
  assert.equal(events.length,0,'edits do not upload insertion content');
  for (const text of ['x','x'.repeat(9000)]) {
   listeners.change({...event,contentChanges:[{text,rangeLength:0}]});
   assert.equal(messages.at(-1).clock.seconds,30);
   assert.ok(!('insertion' in messages.at(-1)));
  }
 } finally {sidebar.clearEvidenceSubscriptions();}
 assert.equal(sidebar.evidenceConsent,false);
});

test('code insertion feature is removed, not merely hidden',()=>{
 const ui=readFileSync('src/webviewHtml.ts','utf8');
 const extension=readFileSync('src/extension.ts','utf8');
 const activity=readFileSync('src/sessionActivity.ts','utf8');
 for(const source of [ui,extension,activity]) {
  for(const removed of ['insertionNotice','insertionSignal','largeCodeInsertion','Large edit noticed','Possible AI copy-paste detected']) assert.ok(!source.includes(removed),removed);
 }
 assert.ok(ui.includes('afkClock'));
 assert.ok(ui.includes('Run Tests'));
});
