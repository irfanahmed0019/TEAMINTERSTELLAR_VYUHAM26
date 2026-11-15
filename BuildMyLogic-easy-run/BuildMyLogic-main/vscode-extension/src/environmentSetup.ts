import { spawn } from 'node:child_process';

/**
 * OS-aware computer setup for BuildMyLogic.
 *
 * Learners need Python, Git and a C compiler on their own computer before the
 * extension's local checks can run their code. This module detects what is
 * already installed, builds the exact install commands for the current OS, and
 * hands a chosen command to a visible VS Code terminal. Detection only runs
 * read-only `--version` probes; nothing here installs anything by itself. The
 * caller must ask the learner before running any install command.
 */

export type ToolId = 'python' | 'git' | 'gcc';

export interface ToolStatus {
  id: ToolId;
  name: string;
  installed: boolean;
  version: string;
  checkCommand: string;
  installCommands: string[];
  note: string;
}

export interface SetupReport {
  os: 'Windows' | 'macOS' | 'Linux';
  packageManager: string;
  tools: ToolStatus[];
  missing: number;
}

function probe(command: string, timeoutMs = 8000): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean, output: string) => { if (!settled) { settled = true; resolve({ ok, output }); } };
    let child;
    try {
      child = spawn(command, { shell: true, windowsHide: true });
    } catch (error) {
      finish(false, String(error));
      return;
    }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* probe already exited */ } finish(false, 'Check timed out.'); }, timeoutMs);
    let output = '';
    child.stdout?.on('data', (chunk) => { output += String(chunk); });
    child.stderr?.on('data', (chunk) => { output += String(chunk); });
    child.on('error', (error) => { clearTimeout(timer); finish(false, String(error)); });
    child.on('close', (code) => { clearTimeout(timer); finish(code === 0, output.trim().split('\n')[0]?.slice(0, 120) || ''); });
  });
}

async function detectPackageManager(platform: NodeJS.Platform = process.platform): Promise<string> {
  if (platform === 'win32') return (await probe('winget --version')).ok ? 'winget' : '';
  if (platform === 'darwin') return (await probe('brew --version')).ok ? 'brew' : '';
  for (const manager of ['apt-get', 'dnf', 'pacman', 'zypper']) {
    if ((await probe(`command -v ${manager}`)).ok) return manager;
  }
  return '';
}

function installCommands(tool: ToolId, packageManager: string, platform: NodeJS.Platform = process.platform): { commands: string[]; note: string } {
  if (platform === 'win32') {
    const agreements = '--accept-package-agreements --accept-source-agreements';
    if (tool === 'python') return { commands: [`winget install -e --id Python.Python.3.12 ${agreements}`], note: 'After installing, restart VS Code so the new Python is found.' };
    if (tool === 'git') return { commands: [`winget install -e --id Git.Git ${agreements}`], note: 'After installing, restart VS Code so Git is found.' };
    return { commands: [`winget install -e --id MSYS2.MSYS2 ${agreements}`], note: 'Windows needs a C compiler for C missions. This installs MSYS2; when it finishes open the MSYS2 UCRT64 shell and run: pacman -S --needed mingw-w64-ucrt-x86_64-gcc. MSYS2 does not put gcc on the Windows PATH by itself, so VS Code will still report the C compiler missing until you add C:\\msys64\\ucrt64\\bin to your PATH and restart VS Code.' };
  }
  if (platform === 'darwin') {
    if (tool === 'python') {
      return packageManager === 'brew'
        ? { commands: ['brew install python@3.12'], note: 'After installing, restart VS Code so the new Python is found.' }
        : { commands: [], note: 'Install Homebrew from https://brew.sh and then run: brew install python@3.12 - or install Python from https://www.python.org/downloads/' };
    }
    if (tool === 'git') return { commands: ['xcode-select --install'], note: 'Apple\'s command line tools include Git. A system dialog opens; confirm it there.' };
    return { commands: ['xcode-select --install'], note: 'Apple\'s command line tools include the clang C compiler used for C missions.' };
  }
  switch (packageManager) {
    case 'apt-get':
      if (tool === 'python') return { commands: ['sudo apt update && sudo apt install -y python3 python3-venv python3-pip'], note: 'Uses apt with sudo; the terminal will ask for your password.' };
      if (tool === 'git') return { commands: ['sudo apt update && sudo apt install -y git'], note: 'Uses apt with sudo; the terminal will ask for your password.' };
      return { commands: ['sudo apt update && sudo apt install -y build-essential'], note: 'build-essential provides gcc for C missions.' };
    case 'dnf':
      if (tool === 'python') return { commands: ['sudo dnf install -y python3 python3-pip'], note: 'Uses dnf with sudo; the terminal will ask for your password.' };
      if (tool === 'git') return { commands: ['sudo dnf install -y git'], note: 'Uses dnf with sudo; the terminal will ask for your password.' };
      return { commands: ['sudo dnf install -y gcc'], note: 'Provides gcc for C missions.' };
    case 'pacman':
      if (tool === 'python') return { commands: ['sudo pacman -S --needed --noconfirm python python-pip'], note: 'Uses pacman with sudo; the terminal will ask for your password.' };
      if (tool === 'git') return { commands: ['sudo pacman -S --needed --noconfirm git'], note: 'Uses pacman with sudo; the terminal will ask for your password.' };
      return { commands: ['sudo pacman -S --needed --noconfirm base-devel'], note: 'base-devel provides gcc for C missions.' };
    case 'zypper':
      if (tool === 'python') return { commands: ['sudo zypper install -y python3 python3-pip'], note: 'Uses zypper with sudo; the terminal will ask for your password.' };
      if (tool === 'git') return { commands: ['sudo zypper install -y git'], note: 'Uses zypper with sudo; the terminal will ask for your password.' };
      return { commands: ['sudo zypper install -y gcc'], note: 'Provides gcc for C missions.' };
    default:
      return { commands: [], note: 'Install this tool with your Linux distribution\'s package manager, then re-check.' };
  }
}

async function checkPython(platform: NodeJS.Platform = process.platform): Promise<{ installed: boolean; version: string; checkCommand: string }> {
  const candidates = platform === 'win32'
    ? ['py -3 --version', 'python --version']
    : ['python3 --version', 'python --version'];
  for (const command of candidates) {
    const result = await probe(command);
    if (result.ok && /Python 3\./i.test(result.output)) return { installed: true, version: result.output, checkCommand: command };
  }
  return { installed: false, version: '', checkCommand: candidates[0] };
}

async function checkTool(tool: ToolId, platform: NodeJS.Platform = process.platform): Promise<{ installed: boolean; version: string; checkCommand: string }> {
  if (tool === 'python') return checkPython(platform);
  if (tool === 'git') {
    const result = await probe('git --version');
    return { installed: result.ok, version: result.ok ? result.output : '', checkCommand: 'git --version' };
  }
  const gcc = await probe('gcc --version');
  if (gcc.ok) return { installed: true, version: gcc.output, checkCommand: 'gcc --version' };
  if (platform === 'darwin') {
    const clang = await probe('clang --version');
    if (clang.ok) return { installed: true, version: clang.output, checkCommand: 'clang --version' };
  }
  return { installed: false, version: '', checkCommand: 'gcc --version' };
}

const TOOL_NAMES: Record<ToolId, string> = { python: 'Python 3', git: 'Git', gcc: 'C compiler (gcc)' };

export async function detectSetup(platform: NodeJS.Platform = process.platform): Promise<SetupReport> {
  const packageManager = await detectPackageManager(platform);
  const tools: ToolStatus[] = [];
  for (const id of ['python', 'git', 'gcc'] as ToolId[]) {
    const status = await checkTool(id, platform);
    const install = status.installed ? { commands: [], note: '' } : installCommands(id, packageManager, platform);
    tools.push({ id, name: TOOL_NAMES[id], installed: status.installed, version: status.version, checkCommand: status.checkCommand, installCommands: install.commands, note: install.note });
  }
  const os = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux';
  return { os, packageManager, tools, missing: tools.filter((tool) => !tool.installed).length };
}

export function installPlanFor(toolId: ToolId, packageManager: string, platform: NodeJS.Platform = process.platform): { commands: string[]; note: string } {
  return installCommands(toolId, packageManager, platform);
}
