import * as vscode from 'vscode';
import { MentorClient, MentorState, MentorAskKind } from './mentorClient';
import { MENTOR_LESSONS, MENTOR_REMEDIALS, MENTOR_SKILLS, mentorExerciseMeta, MentorLessonMeta, MentorExerciseMeta } from './mentorCurriculum';
import { mentorHtml } from './mentorWebviewHtml';
import { MentorWatcher, WatchStatus } from './mentorWatcher';

export const MENTOR_VIEW_ID = 'buildMyLogic.mentor';
const TOKEN_SECRET_KEY = 'buildMyLogic.mentorToken';

export interface MentorConnect {
	apiBaseUrl: string;
	token: string;
}

type MentorMessage =
	| { command: 'ready' }
	| { command: 'refresh' }
	| { command: 'start'; level: 'beginner' | 'intermediate' | 'advanced' }
	| { command: 'select-lesson'; lessonId: string }
	| { command: 'select-revision'; revisionId: string | null }
	| { command: 'run' }
	| { command: 'submit' }
	| { command: 'hint' }
	| { command: 'ask'; kind: MentorAskKind; message: string }
	| { command: 'open-starter' }
	| { command: 'disconnect' };

/**
 * AI Mentor sidebar: milestones, the current task, real graded submissions,
 * progressive hints and task-aware chat - all against the same persisted
 * MentorState the website uses. The auth token arrives only through the local
 * bridge from the signed-in website and lives in VS Code SecretStorage; it is
 * never written to settings, logs or the webview.
 */
export class MentorPanel implements vscode.WebviewViewProvider {
	private view?: vscode.WebviewView;
	private state?: MentorState | null;
	private token?: string;
	private busy = false;
	private selectedRevisionId: string | null = null;
	private lastFeedback = '';
	private pollTimer?: NodeJS.Timeout;
	private readonly watcher: MentorWatcher;
	private monitor: WatchStatus = { active: false, reason: 'Not connected to the AI Mentor.' };
	private hintLog: { lessonId: string; hints: string[] } = { lessonId: '', hints: [] };
	private chatLog: { who: 'you' | 'mentor'; text: string }[] = [];

	public constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly client: MentorClient,
	) {
		this.watcher = new MentorWatcher(client);
		this.watcher.setStatusListener((status) => { this.monitor = status; this.render(); });
	}

	/** Point the learning watcher at the current exercise's file. */
	private retargetWatcher(force = false): void {
		void this.ensureToken().then((token) => {
			const current = this.currentExercise();
			this.watcher.retarget(current?.exercise.id, this.state?.id, token, force);
		});
	}

	public resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = { enableScripts: true };
		view.webview.html = mentorHtml(view.webview.cspSource);
		view.onDidDispose(() => { this.view = undefined; this.stopPolling(); });
		view.webview.onDidReceiveMessage((m: unknown) => { if (valid(m)) void this.handle(m); });
	}

	/** Entry point for the local bridge's /mentor-connect delivery. Throws if the
	 * token cannot be stored securely, so the bridge answers 503 and no
	 * connected state is shown. */
	public async connectFromBridge(connect: MentorConnect): Promise<void> {
		await this.storeMentorToken(connect.token);
		this.client.setBaseUrl(connect.apiBaseUrl);
		await vscode.workspace.getConfiguration('buildMyLogic').update('apiBaseUrl', connect.apiBaseUrl, vscode.ConfigurationTarget.Global);
		this.token = connect.token;
		this.selectedRevisionId = null;
		try { await this.refresh(true); } catch { /* A load failure is surfaced in the sidebar, not as a connect failure. */ }
		try { await vscode.commands.executeCommand('workbench.view.extension.buildMyLogic'); } catch { /* view may already be open */ }
	}

	/** Store the mentor token in SecretStorage and prove it landed. Throws when
	 * the OS keyring is unavailable, hung, or silently drops the write. */
	private async storeMentorToken(token: string): Promise<void> {
		const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Secure storage timed out.')), 8000));
		await Promise.race([(async () => {
			await this.context.secrets.store(TOKEN_SECRET_KEY, token);
			const readBack = await this.context.secrets.get(TOKEN_SECRET_KEY);
			if (readBack !== token) throw new Error('Secure storage verification failed.');
		})(), timeout]);
	}

	private async ensureToken(): Promise<string | undefined> {
		if (!this.token) this.token = await this.context.secrets.get(TOKEN_SECRET_KEY);
		return this.token;
	}

	private async handle(m: MentorMessage): Promise<void> {
		try {
			if (m.command === 'ready') return void (await this.refresh(false));
			if (m.command === 'disconnect') {
				this.stopPolling();
				await this.watcher.stop('watch_stopped');
				this.state = undefined;
				this.token = undefined;
				this.selectedRevisionId = null;
				await this.context.secrets.delete(TOKEN_SECRET_KEY);
				this.render();
				return this.status('Disconnected from the AI Mentor on this machine.', false);
			}
			if (m.command === 'refresh') return void (await this.refresh(true));
			if (m.command === 'open-starter') return void (await this.openStarter());
			if (this.busy) return this.status('Working on the previous request...', false);
			if (m.command === 'start') return void (await this.guard(() => this.start(m.level)));
			if (!this.state) return this.status('Connect from the BuildMyLogic website first.', true);
			if (m.command === 'select-lesson') return void (await this.guard(() => this.selectLesson(m.lessonId)));
			if (m.command === 'select-revision') { this.selectedRevisionId = m.revisionId; return this.render(); }
			if (m.command === 'run') return void (await this.guard(() => this.run()));
			if (m.command === 'submit') return void (await this.guard(() => this.submit()));
			if (m.command === 'hint') return void (await this.guard(() => this.hint()));
			if (m.command === 'ask') return void (await this.guard(() => this.ask(m.kind, m.message)));
		} catch (error) {
			this.status(error instanceof Error ? error.message : 'Mentor action failed.', true);
		}
	}

	private async guard(action: () => Promise<void>): Promise<void> {
		this.busy = true;
		this.post({ type: 'busy', busy: true });
		try { await action(); } finally {
			this.busy = false;
			this.post({ type: 'busy', busy: false });
		}
	}

	private async refresh(announce: boolean): Promise<void> {
		const token = await this.ensureToken();
		if (!token) { this.state = undefined; this.render(); if (announce) this.status('Not connected yet. On the BuildMyLogic website, open AI Mentor and choose "Connect VS Code".', false); return; }
		try {
			const r = await this.client.latest(token);
			this.state = r.state;
			this.stopPolling();
			if (this.state) { this.startPolling(); this.retargetWatcher(); }
			this.render();
			if (announce) this.status(this.state ? 'AI Mentor session loaded.' : 'Signed in. No mentor session yet - pick a level to start.', false);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Could not load your mentor session.';
			if (/sign in|401|unauthor/i.test(message)) {
				this.state = undefined;
				this.render();
				this.status('This VS Code connection expired or was revoked. Reconnect from the AI Mentor page on the website.', true);
			} else {
				this.status(message, true);
			}
		}
	}

	private startPolling(): void {
		this.pollTimer = setInterval(() => void this.refresh(false), 30000);
	}
	private stopPolling(): void {
		if (this.pollTimer) clearInterval(this.pollTimer);
		this.pollTimer = undefined;
	}

	private async start(level: 'beginner' | 'intermediate' | 'advanced'): Promise<void> {
		const token = await this.mustToken();
		const r = await this.client.start(token, level);
		this.state = r.state;
		this.selectedRevisionId = null;
		this.startPolling();
		this.retargetWatcher();
		this.render();
		this.status(`Started "${r.state.roadmap.title}" at ${level} level (roadmap: ${r.state.roadmap.source}).`, false);
	}

	private async selectLesson(lessonId: string): Promise<void> {
		const token = await this.mustToken();
		if (!this.state) return;
		const r = await this.client.selectLesson(token, this.state.id, lessonId);
		this.state = r.state;
		this.selectedRevisionId = null;
		if (this.hintLog.lessonId !== lessonId) this.hintLog = { lessonId, hints: [] };
		this.retargetWatcher();
		this.render();
	}

	private currentLessonMeta(): MentorLessonMeta | undefined {
		if (!this.state) return undefined;
		return MENTOR_LESSONS.find((l) => l.id === this.state!.currentLessonId);
	}

	private currentExercise(): { exercise: MentorExerciseMeta & { remedialFor?: string }; lessonId: string; revisionId?: string } | undefined {
		if (!this.state) return undefined;
		if (this.selectedRevisionId) {
			const revision = this.state.revisions.find((r) => r.id === this.selectedRevisionId && r.status === 'scheduled');
			if (revision) {
				const exercise = mentorExerciseMeta(revision.exerciseId);
				if (exercise) return { exercise, lessonId: revision.lessonId, revisionId: revision.id };
			}
			this.selectedRevisionId = null;
		}
		const lessonId = this.state.currentLessonId;
		const progress = this.state.lessons[lessonId];
		if (!progress || progress.status === 'locked') return undefined;
		const exercise = mentorExerciseMeta(progress.activeExerciseId);
		return exercise ? { exercise, lessonId } : undefined;
	}

	private activeCCode(): string {
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document.getText().trim()) return editor.document.getText();
		throw new Error('Open your C file in the editor first (or use "Open starter code"), then run or submit.');
	}

	private async run(): Promise<void> {
		const current = this.currentExercise();
		if (!current) throw new Error('No active exercise to run.');
		const code = this.activeCCode();
		if (!code.trim()) throw new Error('The editor is empty. Write some C code first.');
		const stdins = current.exercise.tests.slice(0, 10).map((t) => t.stdin);
		this.status(`Running against ${stdins.length} test input(s) on the sandbox (trial run - not graded, not saved)...`, false);
		const r = await this.client.run(code, stdins);
		this.post({ type: 'run-result', items: r.items, tests: current.exercise.tests.slice(0, 10).map((t) => ({ name: t.name, hidden: t.hidden })), sandbox: r.sandbox || 'Judge0 sandbox', taskId: current.revisionId ?? current.exercise.id, taskTitle: current.exercise.title });
	}

	private async submit(): Promise<void> {
		const token = await this.mustToken();
		if (!this.state) return;
		const current = this.currentExercise();
		if (!current) throw new Error('No active exercise to submit.');
		const code = this.activeCCode();
		if (!code.trim()) throw new Error('The editor is empty. Write some C code first.');
		this.status('Submitting for real grading. This runs your code against every test and updates your learning record...', false);
		const r = await this.client.submit(token, this.state.id, current.lessonId, current.exercise.id, code, current.revisionId);
		this.state = r.state;
		this.lastFeedback = r.assessment.feedback;
		if (r.assessment.status === 'passed') this.selectedRevisionId = null;
		this.retargetWatcher();
		this.render();
		this.post({ type: 'submit-result', results: r.results, assessment: r.assessment, decision: r.decision, taskId: current.revisionId ?? current.exercise.id, taskTitle: current.exercise.title });
		if (r.assessment.status === 'passed') {
			void vscode.window.showInformationMessage(`BuildMyLogic: ${current.exercise.title} passed.`);
		} else if (r.assessment.feedback) {
			void vscode.window.showInformationMessage(`BuildMyLogic Suggestion: ${r.assessment.feedback.slice(0, 200)}`);
		}
	}

	private async hint(): Promise<void> {
		const token = await this.mustToken();
		if (!this.state) return;
		const current = this.currentExercise();
		if (!current) throw new Error('No active exercise for hints.');
		const r = await this.client.hint(token, this.state.id, current.lessonId, current.revisionId);
		this.state = r.state;
		if (this.hintLog.lessonId !== current.lessonId) this.hintLog = { lessonId: current.lessonId, hints: [] };
		this.hintLog.hints.push(r.hint);
		this.render();
		this.post({ type: 'hint', hint: r.hint });
	}

	private async ask(kind: MentorAskKind, message: string): Promise<void> {
		const token = await this.mustToken();
		if (!this.state) return;
		const current = this.currentExercise();
		const lesson = this.currentLessonMeta();
		if (!lesson) throw new Error('No active lesson.');
		const editor = vscode.window.activeTextEditor;
		const code = editor ? editor.document.getText().slice(0, 4000) : '';
		const QUICK: Record<string, string> = { simpler: 'Explain this in simpler words.', another_example: 'Show me another example.', why_works: 'Why does this code work?', explain_mistake: 'Explain my mistake.', similar_problem: 'Give me a similar problem.', hint: 'Give me a hint.' };
		this.chatLog.push({ who: 'you', text: message || QUICK[kind] || kind });
		this.chatLog = this.chatLog.slice(-50);
		const r = await this.client.ask(token, {
			kind,
			level: this.state.level,
			lessonTitle: lesson.title,
			objective: lesson.objective,
			exercisePrompt: current ? current.exercise.prompt : '',
			code,
			lastFeedback: this.lastFeedback,
			misconceptions: Object.values(this.state.misconceptions).filter((m) => m.status === 'active').map((m) => m.evidence).slice(0, 5),
			hintsUsed: this.state.lessons[lesson.id]?.hintsUsed ?? 0,
			message,
		});
		this.chatLog.push({ who: 'mentor', text: r.message });
		this.chatLog = this.chatLog.slice(-50);
		this.render();
		this.post({ type: 'chat-reply', text: r.message });
	}

	private async openStarter(): Promise<void> {
		const current = this.currentExercise();
		if (!current) throw new Error('No active exercise.');
		const root = vscode.workspace.workspaceFolders?.[0]?.uri;
		const name = `${current.exercise.id}.c`;
		const uri = root ? vscode.Uri.joinPath(root, name) : undefined;
		if (uri) {
			let exists = true;
			try { await vscode.workspace.fs.stat(uri); } catch { exists = false; }
			if (!exists) await vscode.workspace.fs.writeFile(uri, Buffer.from(current.exercise.starter, 'utf8'));
			const doc = await vscode.workspace.openTextDocument(uri);
			await vscode.window.showTextDocument(doc);
			this.retargetWatcher(true);
		} else {
			const doc = await vscode.workspace.openTextDocument({ language: 'c', content: current.exercise.starter });
			await vscode.window.showTextDocument(doc);
		}
	}

	private async mustToken(): Promise<string> {
		const token = await this.ensureToken();
		if (!token) throw new Error('Not connected. On the BuildMyLogic website, open AI Mentor and choose "Connect VS Code".');
		return token;
	}

	private render(): void {
		const s = this.state ?? null;
		const found = this.currentExercise();
		// Hidden test expectations never reach the webview: the server grades
		// them, and the learner must not read answers out of the view source.
		const current = found ? {
			...found,
			exercise: { ...found.exercise, tests: found.exercise.tests.map((t) => (t.hidden ? { ...t, expected: '' } : t)) },
		} : null;
		this.post({
			type: 'render',
			model: {
				connected: Boolean(this.token),
				apiBaseUrl: this.client.getBaseUrl(),
				state: s,
				skills: MENTOR_SKILLS,
				lessons: MENTOR_LESSONS.map((l) => ({ ...l, practice: { ...l.practice, tests: l.practice.tests.map((t) => (t.hidden ? { ...t, expected: '' } : t)) } })),
				remedials: Object.fromEntries(Object.entries(MENTOR_REMEDIALS).map(([k, e]) => [k, { ...e, tests: e.tests.map((t) => (t.hidden ? { ...t, expected: '' } : t)) }])),
				current: current ? { lessonId: current.lessonId, revisionId: current.revisionId ?? null, exercise: current.exercise } : null,
				selectedRevisionId: this.selectedRevisionId,
				monitor: this.monitor,
				hintLog: this.hintLog.lessonId === (current?.lessonId ?? this.hintLog.lessonId) ? this.hintLog.hints : [],
				chatLog: this.chatLog,
			},
		});
	}

	private status(text: string, error: boolean): void { this.post({ type: 'status', text, error }); }
	private post(message: unknown): void { void this.view?.webview.postMessage(message); }
}

function valid(v: unknown): v is MentorMessage {
	if (!v || typeof v !== 'object') return false;
	const command = String((v as { command?: unknown }).command);
	return ['ready', 'refresh', 'start', 'select-lesson', 'select-revision', 'run', 'submit', 'hint', 'ask', 'open-starter', 'disconnect'].includes(command);
}
