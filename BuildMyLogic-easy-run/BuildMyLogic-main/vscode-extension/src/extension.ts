import * as vscode from 'vscode';
import { executeLocalCommand } from './processRunner';
import { loadAppConfig } from './config';
import { SessionClient, RemoteSession } from './sessionClient';
import { sidebarHtml } from './webviewHtml';
import { ResultsPanel, RESULTS_VIEW_ID } from './resultsPanel';
import { startBridge, consumeStagedSession, SessionConnect } from './bridge';
import { MentorClient } from './mentorClient';
import { MentorPanel, MENTOR_VIEW_ID } from './mentorPanel';

const viewId = 'buildMyLogic.sidebar';
type Connection = { sessionId: string };
type Message = { command: 'ready' | 'connect' | 'hint' | 'stuck' | 'runTests' | 'submit' | 'failed' | 'disconnect' | 'reassess' | 'openMentor'; sessionId?: string };

class Sidebar implements vscode.WebviewViewProvider {
  private running = false;
  private connectEpoch = 0;
  private view?: vscode.WebviewView; private session?: RemoteSession; private connection?: Connection; private live = false; private loopToken = 0; private lastHeartbeatAt = 0; private evidenceSubscriptions: vscode.Disposable[] = []; private diagnosticTimer?: NodeJS.Timeout; private pendingUriSession?: { sessionId: string };
  constructor(private readonly api: SessionClient, private readonly results: ResultsPanel) {}
  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view; view.webview.options = { enableScripts: true }; view.webview.html = sidebarHtml(view.webview.cspSource);
    view.onDidDispose(() => { this.stop(); this.clearEvidenceSubscriptions(); }); view.webview.onDidReceiveMessage((m: unknown) => { if (valid(m)) void this.handle(m); });
    const pending = this.pendingUriSession; this.pendingUriSession = undefined;
    if (pending?.sessionId) void this.connect(pending.sessionId, false);
    else { const saved = vscode.workspace.getConfiguration('buildMyLogic').get<Connection>('session'); if (saved?.sessionId) void this.connect(saved.sessionId, true); }
  }
  private async waitForView(timeout = 2500) { const started = Date.now(); while (!this.view && Date.now() - started < timeout) await new Promise((resolve) => setTimeout(resolve, 50)); }
  public async connectFromUri(uri: vscode.Uri) {
    try {
      const params = new URLSearchParams(uri.query);
      const sessionId = params.get('sessionId') || params.get('session_id') || '';
      if (!sessionId) return this.status('The BuildMyLogic link is missing its Session ID.', true);
      const apiBaseUrl = params.get('apiBaseUrl') || params.get('api_base_url') || '';
      if (apiBaseUrl) {
        const parsed = new URL(apiBaseUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('The BuildMyLogic connection link has an invalid API address.');
        this.api.setBaseUrl(parsed.origin);
        await vscode.workspace.getConfiguration('buildMyLogic').update('apiBaseUrl', parsed.origin, vscode.ConfigurationTarget.Global);
      }
      this.pendingUriSession = { sessionId };
      try { await vscode.commands.executeCommand('workbench.view.extension.buildMyLogic'); } catch { /* The URI still activates the extension if the view command is unavailable. */ }
      await this.waitForView();
      if (this.view && this.pendingUriSession?.sessionId === sessionId) {
        this.pendingUriSession = undefined;
        await this.connect(sessionId, false);
      }
    } catch (error) { this.status(error instanceof Error ? error.message : 'Could not connect the BuildMyLogic session.', true); }
  }
  private async handle(m: Message) {
    try {
      if (m.command === 'ready') { if (this.session) this.post({type:'session',session:this.session}); return; }
      if (m.command === 'openMentor') { await vscode.commands.executeCommand('buildmylogic.openMentor'); return; }
      if (m.command === 'connect') return void this.connect(m.sessionId || '', false);
      if (m.command === 'disconnect') { this.connectEpoch++; this.stop(); this.clearEvidenceSubscriptions(); this.session = undefined; this.connection = undefined; await vscode.workspace.getConfiguration('buildMyLogic').update('session', undefined, vscode.ConfigurationTarget.Global); this.results.update(undefined, ''); return this.post({ type: 'disconnected' }); }
      if (!this.session || !this.connection) return this.status('Connect an active BuildMyLogic session first.', true);
      if (m.command === 'reassess') { const url = new URL('/reassess', this.api.getBaseUrl()); url.searchParams.set('session', this.connection.sessionId); await vscode.env.openExternal(vscode.Uri.parse(url.toString())); return; }
      if (m.command === 'hint' || m.command === 'stuck') { const connection = this.connection; const r = await this.api.hint(connection.sessionId, m.command === 'stuck'); if (this.connection !== connection) return; this.session = r.state || this.session; return this.post({ type: 'guidance', text: r.guidance, session: this.session }); }
      if (m.command === 'failed') { const connection = this.connection; const yes = await vscode.window.showWarningMessage("You couldn't complete this challenge? This marks it failed and starts recovery.", { modal: true }, 'Yes, Help Me Recover'); if (yes !== 'Yes, Help Me Recover' || this.connection !== connection) return; const r = await this.api.fail(connection.sessionId, 'Learner selected I Failed'); if (this.connection !== connection) return; this.session = r.state || this.session; return this.post({ type: 'failed', text: `${r.recovery || ''}\n\nMini-task: ${r.mini_task || ''}`, session: this.session }); }
      if (m.command === 'submit' || m.command === 'runTests') {
        if (this.running) return this.status('Wait for the current workspace action to finish.');
        this.running = true;
        try { if (m.command === 'submit') await this.submitProject(); else await this.test(); }
        finally { this.running = false; }
      }
    } catch (e) { this.status(e instanceof Error ? e.message : 'Session action failed.', true); }
  }
  private async connect(sessionId: string, silent: boolean) {
    sessionId = sessionId.trim().toUpperCase(); if (!/^[A-Z0-9][A-Z0-9_-]{5,39}$/.test(sessionId)) { if (!silent) this.status('Enter the Session ID copied from the BuildMyLogic website.', true); return; }
    const epoch = ++this.connectEpoch;
    this.stop(); this.clearEvidenceSubscriptions(); this.session = undefined; this.connection = undefined; this.results.update(undefined, ''); this.post({ type: 'disconnected' });
    try {
      if (!silent) this.status('Connecting to your BuildMyLogic session…');
      const r = await this.api.connect(sessionId); if (epoch !== this.connectEpoch) return; if (!r.session) throw new Error('Session has no challenge context.'); this.session = r.session; this.connection = { sessionId };
      await vscode.workspace.getConfiguration('buildMyLogic').update('session', this.connection, vscode.ConfigurationTarget.Global); await vscode.workspace.getConfiguration('buildMyLogic').update('apiBaseUrl', this.api.getBaseUrl(), vscode.ConfigurationTarget.Global); this.post({ type: 'session', session: this.session }); this.status('Connected. Your challenge is ready.', false); this.installEvidenceSubscriptions(); this.startLiveSync();
    } catch (error) {
      if (epoch !== this.connectEpoch) return;
      this.session = undefined; this.connection = undefined; this.stop(); this.clearEvidenceSubscriptions();
      await vscode.workspace.getConfiguration('buildMyLogic').update('session', undefined, vscode.ConfigurationTarget.Global);
      const message = error instanceof Error ? error.message : 'This Session ID is not active.';
      this.status(`${message} Start a new session on the BuildMyLogic website, then use its generated ID.`, true);
    }
  }
  /** Stop the live sync loop (used on disconnect and when the view closes). */
  private stop() {
    this.live = false;
    this.loopToken += 1;
    this.lastHeartbeatAt = 0;
  }
  /**
   * Live sync: long-poll the session state so anything the learner changes on
   * the BuildMyLogic website (hint, status, checkpoint, mentor note) renders in
   * VS Code the moment it happens instead of after a 15 second timer.
   * A heartbeat still goes out every 15s so the website can show the extension
   * as connected.
   */
  private startLiveSync() {
    this.stop();
    this.live = true;
    const token = this.loopToken;
    void this.liveSync(token);
  }
  private async liveSync(token: number) {
    while (this.live && token === this.loopToken) {
      const connection = this.connection;
      if (!connection) return;
      try {
        if (Date.now() - this.lastHeartbeatAt >= 15000) {
          await this.api.heartbeat(connection.sessionId);
          this.lastHeartbeatAt = Date.now();
        }
        const since = this.session?.rev;
        const response = await this.api.state(connection.sessionId, { since, waitMs: 8000 });
        if (!this.live || token !== this.loopToken) return;
        this.post({ type: 'connection', connected: true });
        this.status('Connected. Your challenge is ready.');
        const next = response.state;
        if (next && (typeof since !== 'number' || next.rev !== since)) {
          this.session = next;
          this.post({ type: 'session', session: next, live: true });
        }
      } catch {
        if (!this.live || token !== this.loopToken) return;
        this.post({ type: 'connection', connected: false });
        this.status('○ Reconnecting to BuildMyLogic…', true);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  private clearEvidenceSubscriptions() { this.evidenceSubscriptions.forEach((subscription) => subscription.dispose()); this.evidenceSubscriptions = []; if (this.diagnosticTimer) clearTimeout(this.diagnosticTimer); this.diagnosticTimer = undefined; }
  private installEvidenceSubscriptions() {
    this.clearEvidenceSubscriptions();
    if (!this.connection) return;
    this.evidenceSubscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
      if (!this.session || !this.connection || !this.isInActiveWorkspace(document.uri)) return;
      void this.recordFileEvidence(document);
    }));
    this.evidenceSubscriptions.push(vscode.languages.onDidChangeDiagnostics((event) => {
      if (!this.session || !this.connection || !event.uris.some((uri) => this.isInActiveWorkspace(uri))) return;
      if (this.diagnosticTimer) clearTimeout(this.diagnosticTimer);
      this.diagnosticTimer = setTimeout(() => void this.sendDiagnostics(), 500);
    }));
  }
  private async recordFileEvidence(document: vscode.TextDocument) {
    if (!this.session || !this.connection) return;
    const connection = this.connection;
    const signals = await this.collectEvidenceSignals(document);
    if (this.connection !== connection) return;
    try {
      const result = await this.api.event(connection.sessionId, 'file_evidence', { file: vscode.workspace.asRelativePath(document.uri, false).slice(0, 180), language: document.languageId, lines: document.lineCount, signals });
      if (this.connection !== connection) return;
      if (result.state) { this.session = result.state; this.post({ type: 'session', session: this.session }); }
    } catch { /* Evidence is best-effort and never blocks saving a file. */ }
  }
  private async collectEvidenceSignals(document: vscode.TextDocument) {
    const source = document.getText().toLowerCase();
    const relative = vscode.workspace.asRelativePath(document.uri, false).toLowerCase();
    const signals = ['workspace:project', `file:${relative}`];
    if (relative.endsWith('main.py')) signals.push('file:main.py');
    if (/\bprint\s*\(/.test(source)) signals.push('code:print');
    if (/\b(?:import\s+|from\s+)pandas\b/.test(source)) signals.push('dependency:pandas', 'import:pandas');
    if (/\b(?:import\s+|from\s+)matplotlib\b/.test(source)) signals.push('dependency:matplotlib', 'import:matplotlib');
    if (/\b(venv|virtualenv)\b/.test(source)) signals.push('code:venv');
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!root) return signals;
    for (const name of ['venv', '.venv', 'requirements.txt', 'pyproject.toml']) {
      try { await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, name)); signals.push(`workspace:${name}`); } catch { /* Missing workspace evidence is expected. */ }
    }
    try {
      const requirements = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(root, 'requirements.txt'));
      const text = new TextDecoder().decode(requirements).toLowerCase();
      if (text.includes('pandas')) signals.push('dependency:pandas');
      if (text.includes('matplotlib')) signals.push('dependency:matplotlib');
    } catch { /* requirements.txt is optional. */ }
    return signals.slice(0, 30);
  }
  private isInActiveWorkspace(uri: vscode.Uri) { const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath; return Boolean(root && uri.fsPath.startsWith(root)); }
  private async sendDiagnostics() {
    if (!this.session || !this.connection) return;
    const diagnostics = vscode.languages.getDiagnostics().filter(([uri, items]) => this.isInActiveWorkspace(uri) && items.some((item) => item.severity === vscode.DiagnosticSeverity.Error)).slice(0, 5).map(([uri, items]) => ({ file: vscode.workspace.asRelativePath(uri, false).slice(0, 180), diagnostics: items.filter((item) => item.severity === vscode.DiagnosticSeverity.Error).slice(0, 5).map((item) => ({ message: String(item.message).slice(0, 300), line: item.range.start.line + 1 })) }));
    if (!diagnostics.length) return;
    await this.api.event(this.connection.sessionId, 'compiler_error', { diagnostics, error: diagnostics.map((item) => item.diagnostics.map((diagnostic) => diagnostic.message).join('; ')).join(' | ') }).catch(() => {});
  }
  private async test() {
    if (!this.session || !this.connection) return;
    const connection = this.connection;
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath; if (!folder) throw new Error('Open the challenge workspace before running tests.');
    const plan = await this.api.runPlan(this.connection.sessionId, process.platform);
    if (this.connection !== connection) return;
    this.post({ type: 'status', text: plan.run_plan?.guidance || 'BuildMyLogic is checking the next checkpoint locally.' });
    const checkpointResults = await this.runNextCheckpoint(folder, plan.run_plan?.command || '');
    if (!checkpointResults.length) return;
    if (this.connection !== connection || this.session?.session_id !== connection.sessionId) return this.status('Session changed. Local output was not sent to another session.', true);
    const passed = checkpointResults.filter((item) => item.passed).length;
    const total = this.session.checkpoints?.length || 1;
    const latest = checkpointResults[checkpointResults.length - 1];
    const r = await this.api.test(connection.sessionId, { status: latest?.passed ? 'passed' : 'failed', passed, total, score: passed, error: latest?.passed ? '' : latest?.output, stdout: latest?.output, checkpoint_results: checkpointResults, attempt: this.session.attempts + 1 });
    if (this.connection !== connection) return;
    this.session = r.state || this.session;
    if (this.session.status === 'completed') { this.clearEvidenceSubscriptions(); this.post({ type: 'status', text: 'Challenge proven. Live sync keeps running so the website can send follow-ups.', error: false }); }
    this.results.update(this.session, latest?.output || 'No command output.'); await this.results.show();
    this.post({ type: 'tests', passed: Boolean(latest?.passed), output: latest?.output || 'No command output.', guidance: plan.run_plan?.guidance, session: this.session });
  }

  private async runNextCheckpoint(folder: string, runCommand: string) {
    if (!this.session) return [] as Array<{ index: number; passed: boolean; output: string }>;
    const checkpoints = this.session.checkpoints?.length ? this.session.checkpoints : [{ index: 0, title: 'Run the project', detail: 'Run the project locally.', status: 'active' as const, attempts: 0 }];
    const checkpoint = checkpoints.find((item) => item.status !== 'passed') || checkpoints[checkpoints.length - 1];
    const text = `${checkpoint.title} ${checkpoint.detail}`.toLowerCase();
    let result: { passed: boolean; output: string; cancelled?: boolean };
    if (this.session.language.toLowerCase().includes('python') && text.includes('python') && text.includes('venv')) {
      const version = await this.runCommand(process.platform === 'win32' ? 'py -3 --version' : 'python3 --version', folder, 15000);
      if (version.cancelled) { this.status(version.output); return []; }
      const venv = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0]!.uri, 'venv');
      let venvExists = false; try { await vscode.workspace.fs.stat(venv); venvExists = true; } catch { /* checkpoint reports the missing folder */ }
      result = { passed: version.code === 0 && venvExists, output: `${version.output}\n${venvExists ? 'venv found.' : 'venv is missing. Create it with: ' + (process.platform === 'win32' ? 'py -3 -m venv venv' : 'python3 -m venv venv')}` };
    } else if (this.session.language.toLowerCase().includes('python') && (text.includes('fastapi') || text.includes('jinja2') || text.includes('pip install'))) {
      const python = process.platform === 'win32' ? 'venv\\Scripts\\python.exe' : 'venv/bin/python';
      result = await this.runCommand(`${python} -c "import fastapi, uvicorn, jinja2; print('FastAPI, Uvicorn and Jinja2 are installed.')"`, folder, 20000);
    } else if (text.includes('templates') || text.includes('static') || text.includes('project directory') || text.includes('folder structure')) {
      const root = vscode.workspace.workspaceFolders![0]!.uri;
      const names = ['blog_api', 'blog_api/templates', 'blog_api/static'];
      const missing: string[] = [];
      for (const name of names) { try { await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, ...name.split('/'))); } catch { missing.push(name); } }
      result = { passed: missing.length === 0, output: missing.length ? `Missing required folders: ${missing.join(', ')}` : 'blog_api, templates and static folders are present.' };
    } else {
      result = await this.runCommand(runCommand, folder, runCommand.includes('uvicorn') ? 12000 : 60000);
    }
    if (result.cancelled) { this.status(result.output); return []; }
    return [{ index: checkpoint.index, passed: result.passed, output: result.output }];
  }

  private async runCommand(command: string, cwd: string, timeoutMs: number): Promise<{ code: number; passed: boolean; output: string; cancelled?: boolean }> {
    if (!vscode.workspace.isTrusted) return { code: 1, passed: false, cancelled: true, output: 'Trust this workspace before running local commands. No test was recorded.' };
    const approval = await vscode.window.showWarningMessage(`Run this command locally in ${cwd}?\n${command}`, { modal: true }, 'Run command');
    if (approval !== 'Run command') return { code: 1, passed: false, cancelled: true, output: 'Command cancelled. No test was run or recorded.' };
    const outputChannel = vscode.window.createOutputChannel('BuildMyLogic Tests'); outputChannel.show(true); outputChannel.appendLine(`$ ${command}`);
    return executeLocalCommand(command, cwd, timeoutMs, (text) => outputChannel.append(text));
  }

  private async submitProject() {
    if (!this.connection) return;
    const connection = this.connection;
    if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before submitting files.');
    const consent = await vscode.window.showWarningMessage('Submit project source files to BuildMyLogic and its AI review service? Do not include private data or secrets.', { modal: true }, 'Submit source');
    if (consent !== 'Submit source' || this.connection !== connection) return;
    const root = vscode.workspace.workspaceFolders?.[0]?.uri; if (!root) throw new Error('Open the project folder before submitting it.');
    const excluded = '{**/node_modules/**,**/.git/**,**/venv/**,**/.venv/**,**/__pycache__/**,**/dist/**,**/build/**,**/.env,**/.env.*,**/*.pem,**/*.key,**/.npmrc,**/.pypirc,**/.ssh/**,**/credentials*,**/secrets*}';
    const files: Array<{ path: string; content: string }> = []; let bytes = 0;
    for (const uri of await vscode.workspace.findFiles('**/*', excluded, 250)) {
      if (files.length >= 250 || bytes >= 8 * 1024 * 1024) break;
      try { const raw = await vscode.workspace.fs.readFile(uri); if (raw.includes(0)) continue; const content = Buffer.from(raw).toString('utf8'); if (!content.trim()) continue; files.push({ path: vscode.workspace.asRelativePath(uri, false), content: content.slice(0, 250000) }); bytes += content.length; } catch { /* Ignore unreadable binary files. */ }
    }
    if (this.connection !== connection) return;
    const result = await this.api.submit(connection.sessionId, files); if (this.connection !== connection) return; this.session = result.state || this.session;
    const review = result.review as { score?: number; verdict?: string; strengths?: string[]; issues?: string[]; nextSteps?: string[] } | undefined;
    this.post({ type: 'submission', session: this.session, review, text: `${review?.verdict || 'Project submitted for BuildMyLogic review.'}\n\nFiles reviewed: ${files.length}` });
  }
  private status(text: string, error = false) { this.post({ type: 'status', text, error }); }
  private post(message: unknown) { const m = message as {session?: RemoteSession}; if (m.session) this.results.update(m.session); void this.view?.webview.postMessage(message); }
}
function valid(v: unknown): v is Message { return !!v && typeof v === 'object' && ['ready', 'connect', 'hint', 'stuck', 'runTests', 'submit', 'failed', 'disconnect', 'reassess', 'openMentor'].includes(String((v as Message).command)); }
export function activate(context: vscode.ExtensionContext) {
  const config = loadAppConfig();
  const results = new ResultsPanel();
  const sidebar = new Sidebar(new SessionClient(config.apiBaseUrl), results);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(RESULTS_VIEW_ID, results));
  context.subscriptions.push(vscode.commands.registerCommand('buildmylogic.openMentor', async () => { await vscode.commands.executeCommand('setContext', 'buildMyLogic.showAuthenticatedMentor', true); await vscode.commands.executeCommand('buildMyLogic.mentor.focus'); }));
  const mentor = new MentorPanel(context, new MentorClient(config.apiBaseUrl));
  const connectSession = (connect: SessionConnect) => sidebar.connectFromUri(vscode.Uri.parse(`vscode://buildmylogic.buildmylogic/connect?sessionId=${encodeURIComponent(connect.sessionId)}&apiBaseUrl=${encodeURIComponent(connect.apiBaseUrl)}`));
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(viewId, sidebar));
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(MENTOR_VIEW_ID, mentor));
  context.subscriptions.push(vscode.window.registerUriHandler({ handleUri: (uri) => { void sidebar.connectFromUri(uri); } }));
  // Local desktop bridge: lets the BuildMyLogic website pick a project folder
  // and open it here without any dev server running.
  context.subscriptions.push(startBridge(context, {
    extensionVersion: String(context.extension?.packageJSON?.version || ''),
    connectSession: (connect) => connectSession(connect),
    connectMentor: async (connect) => { await vscode.commands.executeCommand('setContext', 'buildMyLogic.showAuthenticatedMentor', true); return mentor.connectFromBridge(connect); },
  }));
  // A folder opened from the website reloads this window; finish its pending
  // session connect here.
  void consumeStagedSession(context).then((staged) => { if (staged) void connectSession(staged); });
}
export function deactivate() {}
