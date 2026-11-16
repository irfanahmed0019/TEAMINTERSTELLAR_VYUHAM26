import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { IDLE_WINDOW_MS, sessionActivityClock, largeCodeInsertion } from './sessionActivity.ts';
const base={now:100000,activityAt:100000,consent:true,focused:true,paused:false,finished:false};
test('AFK displays the existing 30-second cap exactly, without changing evidence',()=>{
 assert.equal(IDLE_WINDOW_MS,30000);
 assert.equal(sessionActivityClock(base).seconds,30);
 assert.equal(sessionActivityClock({...base,now:129999}).seconds,1);
 assert.equal(sessionActivityClock({...base,now:130000}).state,'afk');
 for (const patch of [{focused:false},{paused:true},{finished:true},{consent:false},{activityAt:0}]) assert.notEqual(sessionActivityClock({...base,...patch}).state,'active');
 assert.equal(sessionActivityClock({...base,now:140000,activityAt:140000}).seconds,30);
});
test('large insertion is an uncertain size heuristic, never AI or clipboard attribution',()=>{
 assert.equal(largeCodeInsertion([{text:'x=1'}],'python',false),undefined);
 assert.equal(largeCodeInsertion([{text:''}],'python',false),undefined);
 for (const text of 'x'.repeat(2000)) assert.equal(largeCodeInsertion([{text,rangeLength:0}],'python',false),undefined,'normal typing never accumulates into a notice');
 assert.equal(largeCodeInsertion([{text:'x'.repeat(800),rangeLength:700}],'python',false),undefined,'formatter or replacement');
 assert.equal(largeCodeInsertion(Array.from({length:500},()=>({text:'x',rangeLength:0})),'python',false),undefined,'multiple small cursor edits');
 assert.equal(largeCodeInsertion([{text:'x'.repeat(800)}],'plaintext',false),undefined);
 assert.equal(largeCodeInsertion([{text:'x'.repeat(800)}],'python',true),undefined);
 assert.deepEqual(largeCodeInsertion([{text:'x'.repeat(400)}],'python',false),{characters:400,lines:1});
 assert.deepEqual(largeCodeInsertion([{text:'x'.repeat(40)+'\n'+'y'.repeat(40)+'\n'+'z'.repeat(40)}],'python',false),{characters:122,lines:3});
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
  assert.deepEqual(sidebar.insertionSignal,{characters:500,lines:1});
  assert.equal(events.length,0,'insertion is local and no source uploaded');
  for (const text of 'normal own typing') listeners.change({...event,contentChanges:[{text,rangeLength:0}]});
  assert.equal(sidebar.insertionSignal,undefined,'normal typing clears a prior insertion notice');
  assert.equal(messages.at(-1).insertion,null);
  listeners.change(event);
  assert.ok(sidebar.insertionSignal);
  sidebar.post({session:{...sidebar.session,status:'completed'}});
  assert.equal(sidebar.insertionSignal,undefined,'completion clears notice even within same task');
  listeners.change(event);
  sidebar.post({session:{...sidebar.session,task_generation:1}});assert.equal(sidebar.insertionSignal,undefined);
  vs.window.state.focused=false;listeners.change(event);assert.equal(sidebar.insertionSignal,undefined);
  vs.window.state.focused=true;listeners.change({...event,document:{...event.document,uri:{scheme:'file',fsPath:'/outside/secret.py'}}});assert.equal(sidebar.insertionSignal,undefined);
  sidebar.session.status='completed';listeners.change(event);assert.equal(sidebar.insertionSignal,undefined);
  sidebar.session.status='connected';sidebar.session.timing={paused:true};listeners.change(event);assert.equal(sidebar.insertionSignal,undefined);
 } finally {sidebar.clearEvidenceSubscriptions();}
 assert.equal(sidebar.evidenceConsent,false);assert.equal(sidebar.insertionSignal,undefined);
});

test('insertion notice never attributes the code to AI or paste detection',()=>{
 const ui=readFileSync('src/webviewHtml.ts','utf8');
 assert.ok(ui.includes('Large edit noticed'));
 assert.ok(ui.includes('This does not tell us how the code was written'));
 assert.ok(!ui.includes('Possible AI copy-paste detected'));
 assert.ok(ui.includes('does not judge authorship, block submission or change passed results'));
});
