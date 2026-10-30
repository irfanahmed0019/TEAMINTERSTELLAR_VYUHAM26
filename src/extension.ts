import * as vscode from 'vscode';
import { AgentEngine } from './agentEngine';
import { AgenticViewProvider } from './viewProvider';

export function activate(context: vscode.ExtensionContext) {
  const engine = new AgentEngine(context);
  const provider = new AgenticViewProvider(context, engine);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('agentic.chat', provider, { webviewOptions: { retainContextWhenHidden: true } }));
  context.subscriptions.push(vscode.commands.registerCommand('agentic.openChat', () => vscode.commands.executeCommand('workbench.view.extension.agentic')));
  context.subscriptions.push(vscode.commands.registerCommand('agentic.setApiKey', async () => {
    const key = await vscode.window.showInputBox({ prompt: 'Agentic API key', password: true, ignoreFocusOut: true });
    if (key) await context.secrets.store('agentic.apiKey', key);
  }));
}
export function deactivate() {}
