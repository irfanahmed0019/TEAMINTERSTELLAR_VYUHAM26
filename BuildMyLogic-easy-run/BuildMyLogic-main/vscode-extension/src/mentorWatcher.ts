import * as vscode from 'vscode';
import { MentorClient, MentorActivity } from './mentorClient';

export type WatchStatus =
	| { active: true; file: string; lastSyncAt?: string; note?: string }
	| { active: false; reason: string };

const MAX_CODE = 12_000;
const MAX_DIAGNOSTICS = 10;
const MIN_INTERVAL_MS = 5_000;
const DIAGNOSTIC_DEBOUNCE_MS = 2_000;

/**
 * The AI Mentor learning watcher. While the mentor is connected it watches the
 * current exercise's own file - nothing else in the workspace - and sends save
 * and diagnostic snapshots to the website. It only runs inside VS Code, so it
 * can never claim to monitor a closed editor or a sleeping machine.
 */
export class MentorWatcher implements vscode.Disposable {
	private disposables: vscode.Disposable[] = [];
	private watchedPath?: string;
	private lastSentAt = 0;
	private pending?: MentorActivity;
	private flushTimer?: NodeJS.Timeout;
	private diagnosticTimer?: NodeJS.Timeout;
	private lastDiagnosticKey = '';
	private unavailable = false;
	private status: WatchStatus = { active: false, reason: 'Not connected to the AI Mentor.' };
	private onStatus: (status: WatchStatus) => void = () => {};

	public constructor(private readonly client: MentorClient) {}

	public setStatusListener(listener: (status: WatchStatus) => void): void {
		this.onStatus = listener;
	}

	public getStatus(): WatchStatus { return this.status; }

	/** The only file the watcher may report on: the current exercise's file in the workspace. */
	public watchedFileFor(exerciseId: string | undefined): vscode.Uri | undefined {
		if (!exerciseId) return undefined;
		const root = vscode.workspace.workspaceFolders?.[0]?.uri;
		if (!root) return undefined;
		return vscode.Uri.joinPath(root, `${exerciseId}.c`);
	}

	/** (Re)target the watcher at the current exercise. Call on connect, lesson change and exercise change. */
	private targetKey = '';

	public retarget(exerciseId: string | undefined, sessionId: string | undefined, token: string | undefined, force = false): void {
		const key = `${exerciseId ?? ''}|${sessionId ?? ''}|${token ? 'set' : ''}`;
		if (!force && key === this.targetKey && this.disposables.length) return;
		this.targetKey = key;
		this.stopLoop();
		if (!token || !sessionId) {
			this.setStatus({ active: false, reason: 'Not connected to the AI Mentor.' });
			return;
		}
		if (!exerciseId) {
			this.setStatus({ active: false, reason: 'Connected, but the current exercise is not available in the extension yet. Use Refresh, or pick the lesson again.' });
			return;
		}
		const uri = this.watchedFileFor(exerciseId);
		if (!uri) {
			this.setStatus({ active: false, reason: 'Open a workspace folder; the exercise file lives there.' });
			return;
		}
		this.watchedPath = uri.fsPath;
		this.sessionId = sessionId;
		this.token = token;
		this.disposables.push(vscode.workspace.onDidSaveTextDocument((doc) => {
			if (doc.uri.fsPath === this.watchedPath) void this.onSave(doc);
		}));
		this.disposables.push(vscode.languages.onDidChangeDiagnostics((event) => {
			if (!event.uris.some((u) => u.fsPath === this.watchedPath)) return;
			if (this.diagnosticTimer) clearTimeout(this.diagnosticTimer);
			this.diagnosticTimer = setTimeout(() => void this.onDiagnostics(), DIAGNOSTIC_DEBOUNCE_MS);
		}));
		this.setStatus({ active: true, file: vscode.workspace.asRelativePath(uri, false) });
		// Announce the watcher only when the file actually exists yet - no claims about files that are not there.
		void vscode.workspace.fs.stat(uri).then(
			() => void this.enqueue({ kind: 'watch_started' }),
			() => this.setStatus({ active: false, reason: 'Open the task file (use "Open starter code") to start monitoring it.' }),
		);
	}

	private sessionId?: string;
	private token?: string;

	private async onSave(doc: vscode.TextDocument): Promise<void> {
		await this.enqueue({
			kind: 'file_save',
			fileOverride: { path: vscode.workspace.asRelativePath(doc.uri, false).slice(0, 180), language: doc.languageId, lines: doc.lineCount },
			code: doc.getText().slice(0, MAX_CODE),
		});
	}

	private async onDiagnostics(): Promise<void> {
		if (!this.watchedPath) return;
		const uri = vscode.Uri.file(this.watchedPath);
		const all = vscode.languages.getDiagnostics(uri)
			.filter((d) => d.severity <= vscode.DiagnosticSeverity.Warning)
			.slice(0, MAX_DIAGNOSTICS)
			.map((d) => ({
				line: d.range.start.line + 1,
				message: String(d.message).slice(0, 300),
				severity: (d.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning') as 'error' | 'warning',
			}));
		const key = JSON.stringify(all);
		if (key === this.lastDiagnosticKey) return;
		this.lastDiagnosticKey = key;
		if (!all.length) return; // a clean file is not an event worth sending
		await this.enqueue({ kind: 'diagnostics', diagnostics: all });
	}

	/** Coalescing sender: at most one activity post per MIN_INTERVAL_MS, latest state wins. */
	private async enqueue(part: { kind: MentorActivity['kind']; code?: string; diagnostics?: MentorActivity['diagnostics']; fileOverride?: MentorActivity['file'] }): Promise<void> {
		if (!this.sessionId || !this.token || !this.watchedPath || this.unavailable) return;
		const file = part.fileOverride ?? { path: vscode.workspace.asRelativePath(vscode.Uri.file(this.watchedPath), false).slice(0, 180), language: 'c', lines: 0 };
		const activity: MentorActivity = {
			sessionId: this.sessionId,
			kind: part.kind,
			at: new Date().toISOString(),
			file,
			...(part.code !== undefined ? { code: part.code } : {}),
			...(part.diagnostics ? { diagnostics: part.diagnostics } : {}),
		};
		this.pending = activity;
		const wait = this.lastSentAt + MIN_INTERVAL_MS - Date.now();
		if (wait > 0) {
			if (this.flushTimer) clearTimeout(this.flushTimer);
			this.flushTimer = setTimeout(() => void this.flush(), wait);
			return;
		}
		await this.flush();
	}

	private async flush(): Promise<void> {
		const activity = this.pending;
		this.pending = undefined;
		if (!activity || !this.token) return;
		this.lastSentAt = Date.now();
		try {
			const r = await this.client.activity(this.token, activity);
			this.setStatus({ active: true, file: activity.file.path, lastSyncAt: activity.at, ...(r.note ? { note: r.note } : {}) });
		} catch (error) {
			const message = error instanceof Error ? error.message : 'sync failed';
			if (/not found|404/i.test(message)) {
				// The website has not deployed the activity route yet: say so once, stop retrying.
				this.unavailable = true;
				this.setStatus({ active: false, reason: 'Activity sync is not deployed on the website yet. Your submissions still save.' });
			} else {
				this.setStatus({ active: true, file: activity.file.path, note: `Last sync failed: ${message}` });
			}
		}
	}

	private setStatus(status: WatchStatus): void {
		this.status = status;
		this.onStatus(status);
	}

	private stopLoop(): void {
		this.disposables.forEach((d) => d.dispose());
		this.disposables = [];
		if (this.diagnosticTimer) clearTimeout(this.diagnosticTimer);
		if (this.flushTimer) clearTimeout(this.flushTimer);
		this.diagnosticTimer = undefined;
		this.flushTimer = undefined;
		this.pending = undefined;
		this.lastDiagnosticKey = '';
	}

	public async stop(kind: 'watch_stopped' | 'silent' = 'watch_stopped'): Promise<void> {
		const wasWatching = Boolean(this.watchedPath && this.sessionId && this.token && !this.unavailable);
		if (kind === 'watch_stopped' && wasWatching) await this.enqueue({ kind: 'watch_stopped' });
		this.stopLoop();
		this.watchedPath = undefined;
		this.sessionId = undefined;
		this.token = undefined;
		this.targetKey = '';
		this.unavailable = false;
		this.setStatus({ active: false, reason: 'Not connected to the AI Mentor.' });
	}

	public dispose(): void {
		this.stopLoop();
	}
}
