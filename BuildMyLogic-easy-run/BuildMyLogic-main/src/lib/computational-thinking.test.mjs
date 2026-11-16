import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { THINKING_STEPS, COMPUTATIONAL_THINKING_GUIDANCE } from './computational-thinking.ts';
test('thinking scaffold covers decomposition, interfaces, AI integration and testing', () => {
 assert.equal(THINKING_STEPS.length,4);
 assert.match(THINKING_STEPS[0].question,/smaller steps/);
 assert.match(THINKING_STEPS[1].question,/function or file/);
 assert.match(THINKING_STEPS[2].question,/depends on/);
 assert.match(THINKING_STEPS[3].question,/normal result and an edge case/);
 assert.match(COMPUTATIONAL_THINKING_GUIDANCE,/AI code is allowed/);
 assert.match(COMPUTATIONAL_THINKING_GUIDANCE,/Do not invent execution results/);
});
test('both mentor endpoints and lesson mentor use shared thinking guidance', () => {
 for(const file of ['mentor/mentor.functions.ts','mentor/mentor.api.server.ts','sarvam.functions.ts']) {
  const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
  assert.match(source,/\$\{COMPUTATIONAL_THINKING_GUIDANCE\}/);
 }
});
test('scratchpad stays optional and disconnected from scoring and AI', () => {
 const source=fs.readFileSync(new URL('../components/learn/ThinkingScaffold.tsx',import.meta.url),'utf8');
 assert.match(source,/not saved or sent to AI/);
 assert.doesNotMatch(source,/fetch\(|localStorage|recordPracticeOutcome|sarvamJson/);
});
