import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual route functions with a simulated desktop bridge. This
// catches accidental changes in ordering, not just matching source strings.
const route = fs.readFileSync(new URL('../routes/sessions.tsx', import.meta.url), 'utf8');
const slice = (from, to) => route.slice(route.indexOf(from), route.indexOf(to));
const functions = [
  slice('  async function pickProjectFolder(', '  function restartSession('),
  slice('  async function startSession(', '  function disconnectVsCode('),
].join('\n');
const js = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

for (const action of ['startSession', 'openAndConnectVsCode']) {
  test(`${action}: earlier folder selection cannot bypass a later cancellation`, async () => {
    const effects = [];
    let picks = 0;
    const context = vm.createContext({
      BRIDGE_URL: 'http://127.0.0.1:8091', AbortSignal, Date,
      running: false, seconds: 1500, startRef: { current: 1500 },
      vscodeSession: null, workspacePath: '/old/project',
      // Retained deliberately: this was the old same-visit bypass.
      folderChosenRef: { current: false },
      folderInputRef: { current: { click: () => effects.push('fallback') } },
      learnerStorage: { setItem: () => {}, removeItem: () => {} },
      fetch: async (url) => {
        if (url.endsWith('/health')) return { ok: true };
        if (url.endsWith('/pick-folder')) {
          picks++;
          return picks === 1
            ? { ok: true, json: async () => ({ ok: true, path: '/selected/project' }) }
            : { ok: false, json: async () => ({ ok: false, error: 'No folder was selected.' }) };
        }
        throw Error('Unexpected request: ' + url);
      },
      setPickingProject: () => {}, setPickerError: () => {},
      setWorkspacePath: () => {}, setProjectFolder: () => {}, setProjectFileCount: () => {},
      setRunning: value => effects.push(['running', value]),
      setVscodeSession: () => {}, setRemoteState: () => {}, setSeconds: () => {},
      createVscodeSession: async () => { effects.push('create'); return { sessionId: 'BML-ABCDE' }; },
      openVsCode: async () => effects.push('launch'),
    });
    vm.runInContext(js, context);
    assert.equal(await vm.runInContext('pickProjectFolder(true)', context), '/selected/project');
    await vm.runInContext(`${action}()`, context);
    assert.equal(picks, 2, 'each action must ask again');
    assert.deepEqual(effects, [], 'cancel must not start, create, launch or open fallback');
  });
}
