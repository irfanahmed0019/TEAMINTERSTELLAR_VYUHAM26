import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installPlanFor, detectSetup } from './environmentSetup.ts';

test('Windows commands use winget and the MSYS2 note explains the PATH step', () => {
  const py = installPlanFor('python', 'winget', 'win32');
  assert.ok(py.commands[0].includes('winget install -e --id Python.Python.3.12'));
  const git = installPlanFor('git', 'winget', 'win32');
  assert.ok(git.commands[0].includes('winget install -e --id Git.Git'));
  const gcc = installPlanFor('gcc', 'winget', 'win32');
  assert.ok(gcc.commands[0].includes('MSYS2.MSYS2'));
  assert.match(gcc.note, /pacman -S --needed mingw-w64-ucrt-x86_64-gcc/);
  assert.match(gcc.note, /ucrt64\\bin/);
  assert.match(gcc.note, /PATH/);
});

test('macOS uses Xcode tools for git/clang and handles a missing Homebrew', () => {
  assert.deepEqual(installPlanFor('git', '', 'darwin').commands, ['xcode-select --install']);
  assert.deepEqual(installPlanFor('gcc', 'brew', 'darwin').commands, ['xcode-select --install']);
  const noBrew = installPlanFor('python', '', 'darwin');
  assert.deepEqual(noBrew.commands, []);
  assert.match(noBrew.note, /brew\.sh/);
  const withBrew = installPlanFor('python', 'brew', 'darwin');
  assert.deepEqual(withBrew.commands, ['brew install python@3.12']);
});

test('Linux package managers map to the right commands, unknown falls back to a manual note', () => {
  assert.match(installPlanFor('python', 'apt-get', 'linux').commands[0], /sudo apt update && sudo apt install -y python3 python3-venv python3-pip/);
  assert.match(installPlanFor('git', 'apt-get', 'linux').commands[0], /sudo apt install -y git/);
  assert.match(installPlanFor('gcc', 'apt-get', 'linux').commands[0], /build-essential/);
  assert.match(installPlanFor('git', 'dnf', 'linux').commands[0], /sudo dnf install -y git/);
  assert.match(installPlanFor('gcc', 'pacman', 'linux').commands[0], /base-devel/);
  assert.match(installPlanFor('python', 'zypper', 'linux').commands[0], /sudo zypper install -y python3/);
  const unknown = installPlanFor('python', '', 'linux');
  assert.deepEqual(unknown.commands, []);
  assert.match(unknown.note, /package manager/);
});

async function withFakeBin(scripts, run) {
  const dir = mkdtempSync(join(tmpdir(), 'bml-fakebin-'));
  for (const [name, body] of Object.entries(scripts)) {
    const path = join(dir, name);
    writeFileSync(path, body);
    chmodSync(path, 0o755);
  }
  const oldPath = process.env.PATH;
  process.env.PATH = dir;
  try { return await run(dir); } finally { process.env.PATH = oldPath; rmSync(dir, { recursive: true, force: true }); }
}

test('Python 2 is never accepted as Python 3, through the real probe path', async () => {
  await withFakeBin({
    python3: '#!/bin/sh\necho "Python 2.7.18"\n',
    python: '#!/bin/sh\necho "Python 2.7.18"\n',
  }, async () => {
    const report = await detectSetup('linux');
    const python = report.tools.find((tool) => tool.id === 'python');
    assert.equal(python.installed, false);
  });
});

test('a real Python 3 probe is accepted with its version string', async () => {
  await withFakeBin({
    python3: '#!/bin/sh\necho "Python 3.11.4"\n',
  }, async () => {
    const report = await detectSetup('linux');
    const python = report.tools.find((tool) => tool.id === 'python');
    assert.equal(python.installed, true);
    assert.match(python.version, /Python 3\.11\.4/);
  });
});

test('missing tools with no known package manager produce manual notes, not silent commands', async () => {
  await withFakeBin({}, async () => {
    const report = await detectSetup('linux');
    assert.equal(report.missing, 3);
    assert.equal(report.packageManager, '');
    for (const tool of report.tools) {
      assert.deepEqual(tool.installCommands, []);
      assert.match(tool.note, /package manager/);
    }
  });
});

test('missing tools with apt-get produce sudo apt commands the user must confirm', async () => {
  await withFakeBin({
    'apt-get': '#!/bin/sh\nexit 0\n',
  }, async () => {
    const report = await detectSetup('linux');
    assert.equal(report.packageManager, 'apt-get');
    const git = report.tools.find((tool) => tool.id === 'git');
    assert.equal(git.installed, false);
    assert.match(git.installCommands[0], /sudo apt install -y git/);
  });
});
