import * as vscode from 'vscode';
import { AgentEngine } from './agentEngine';
import { HostMessage, WebviewMessage } from './protocol';

export class AgenticViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  constructor(private readonly context: vscode.ExtensionContext, private readonly engine: AgentEngine) {}
  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((message: WebviewMessage) => this.receive(message));
    this.engine.onEvent(event => this.post(event));
  }
  private async receive(message: WebviewMessage) {
    if (message.type === 'ready') {
      this.post({ type: 'history', messages: this.engine.history });
      this.post(await this.engine.configurationStatus());
    } else if (message.type === 'send') await this.engine.send(message.text);
    else if (message.type === 'approve') await this.engine.resolveApproval(message.id, message.approved);
    else if (message.type === 'openFile') {
      const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0]?.uri ?? this.context.extensionUri, message.path);
      await vscode.window.showTextDocument(uri, { preview: true });
    } else if (message.type === 'setKey') await this.context.secrets.store('agentic.apiKey', message.key);
  }
  private post(message: HostMessage) { void this.view?.webview.postMessage(message); }
  private html(webview: vscode.Webview) {
    const css = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.css'));
    const js = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js'));
    const nonce = String(Date.now());
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="${css}" rel="stylesheet"><title>Agentic</title></head><body><main class="shell"><header><span class="mark"><i></i><i></i><i></i></span><strong>agentic<span>.</span></strong><small id="status">Configure a model to begin</small></header><section id="chat" aria-live="polite"></section><section id="tools"><div class="label">AGENT ACTIVITY</div><div id="tool-list"><p class="empty">Tool calls, approvals, and results appear here.</p></div></section><form id="composer"><textarea id="input" placeholder="Ask Agentic about this workspace…" rows="1"></textarea><footer><span>Ctrl/Cmd + Enter to send</span><button title="Send" type="submit">↑</button></footer></form></main><script nonce="${nonce}" src="${js}"></script></body></html>`;
  }
}
