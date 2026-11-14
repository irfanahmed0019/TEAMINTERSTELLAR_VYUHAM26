import * as vscode from 'vscode';
import type { RemoteSession } from './sessionClient';
export const RESULTS_VIEW_ID = 'buildMyLogic.results';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** A real VS Code panel. Only session evidence and actual command output enter it. */
export class ResultsPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private session?: RemoteSession;
  private output = '';
  public resolveWebviewView(view: vscode.WebviewView) { this.view = view; view.webview.options = { enableScripts: false }; this.render(); }
  public update(session?: RemoteSession, output?: string) { if (this.session?.session_id !== session?.session_id) this.output = ''; this.session = session; if (output !== undefined) this.output = output; this.render(); }
  public async show() { await vscode.commands.executeCommand(`${RESULTS_VIEW_ID}.focus`); }
  private render() {
    if (!this.view) return;
    const s = this.session, score = s?.test_score;
    const cps = s?.checkpoints ?? [];
    this.view.webview.html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>
      *{box-sizing:border-box}body{font:13px var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-panel-background);padding:16px;margin:0}.layout{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:18px}.card{background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-panel-border);border-radius:12px;padding:15px;margin-bottom:12px}h2{font-size:16px;margin:0 0 5px}.muted{color:var(--vscode-descriptionForeground)}.row{display:flex;justify-content:space-between;padding:9px;margin-top:5px;border-radius:6px;background:var(--vscode-list-hoverBackground)}.ok{color:#62d39a}.bad{color:#ff838b}pre{white-space:pre-wrap;word-break:break-word;font:12px var(--vscode-editor-font-family);max-height:160px;overflow:auto}.tag{color:#b69aff;font-size:11px} @media(max-width:650px){.layout{grid-template-columns:1fr}}
    </style></head><body><div class="layout"><section class="card"><h2>${score ? 'Test results received' : 'No test results yet'}</h2><div class="muted">${score ? `${esc(score.passed)} / ${esc(score.total)} reported checks passing · Attempt ${esc(s?.attempts)}` : 'Connect a session and run a workspace check. No result is assumed.'}</div>${cps.map(cp => `<div class="row"><span>${cp.status === 'passed' ? '✓' : cp.status === 'failed' ? '×' : '○'} ${esc(cp.title)}</span><span class="${cp.status === 'passed' ? 'ok' : cp.status === 'failed' ? 'bad' : 'muted'}">${esc(cp.status)}</span></div>`).join('')}<p class="tag">${esc(s?.title || 'BuildMyLogic')} · ${s ? 'Session evidence, not a general skill assessment' : 'Not connected'}</p><pre>${esc(this.output || [...cps].reverse().find(cp => cp.lastOutput)?.lastOutput || 'Actual command output will appear here after a run.')}</pre></section><aside><div class="card"><h2>Attempt summary</h2><div class="row">Passed <b>${score ? esc(score.passed) : 'Not run'}</b></div><div class="row">Total <b>${score ? esc(score.total) : 'Not run'}</b></div><div class="row">Attempts <b>${esc(s?.attempts ?? 0)}</b></div></div><div class="card"><h2>Next step</h2><p>${esc(s?.potential_struggle ? 'Repeated failures recorded. Open Recovery to inspect the evidence and changed-task handoff.' : score && score.passed === score.total ? 'Reported checks pass. Only the published requirements are verified.' : 'Read the actual output, fix one issue and run again.')}</p><span class="muted">Local command reports are client-trusted, not server-attested.</span></div></aside></div></body></html>`;
  }
}
