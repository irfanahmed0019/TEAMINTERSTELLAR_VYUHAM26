import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {sidebarHtml} from './webviewHtml.ts';
test('AFK and AI/code insertion machinery removed, not merely hidden',()=>{
 const extension=readFileSync('src/extension.ts','utf8'),ui=sidebarHtml('');
 for(const removed of ['activityState','afkClock','activityTimer','activityAt','sessionActivityClock','noteActivity','flushActivity','onDidChangeTextDocument','onDidChangeWindowState','"work_activity"','"work_pause"','insertionNotice','insertionSignal','largeCodeInsertion','Large edit noticed','Possible AI copy-paste detected'])for(const source of [extension,ui])assert.ok(!source.includes(removed),removed);
 assert.equal(existsSync('src/sessionActivity.ts'),false);
 for(const kept of ['Run Tests','Submit','Reconnect saved session','Pair session'])assert.ok(ui.includes(kept));
 assert.ok(extension.includes('No AFK, idle or edit timing is tracked.'));
 new Function(ui.match(/<script>([\s\S]*)<\/script>/)[1]);
});
