/**
 * AI Mentor API client (mentor mode). This module is vscode-free on purpose so
 * it can be smoke-tested outside the extension host. The auth token is a
 * mentor-scoped, revocable token (bmlx_...) delivered by the website through
 * the local bridge and stored in VS Code SecretStorage by the caller; this
 * client only ever receives it as a function argument and never logs it.
 */

export type MentorRunItem = { statusId: number; status: string; stdout: string; stderr: string; compileOutput: string; timeSec: number | null };

export type MentorTestResult = { name: string; hidden: boolean; passed: boolean; expected: string; actual: string; status: string; stderr: string };

export type MentorAssessment = {
	status: 'passed' | 'needs_improvement' | 'failed' | 'error';
	errorType: 'none' | 'compile' | 'runtime' | 'wrong_output';
	score: number;
	passed_tests: number;
	total_tests: number;
	misconceptions: { id: string; concept: string; evidence: string }[];
	feedback: string;
	next_action: 'advance' | 'retry' | 'targeted_exercise' | 'prerequisite_review' | 'revision';
	recommended_exercise?: string;
};

export type MentorLessonStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'needs_review';
export type MentorLessonProgress = { status: MentorLessonStatus; attempts: number; bestScore: number; hintsUsed: number; activeExerciseId: string; code: Record<string, string> };
export type MentorCompetency = { skill: string; practicePasses: number; independentPasses: number; failures: number; revisionPasses: number; level: 'not_started' | 'beginner' | 'developing' | 'proficient' | 'mastered'; confirmed: boolean; lastEvidenceAt?: string };
export type MentorMisconception = { id: string; concept: string; count: number; status: 'active' | 'improving' | 'resolved'; firstSeen: string; lastSeen: string; evidence: string };
export type MentorRevision = { id: string; skill: string; concept: string; exerciseId: string; lessonId: string; misconceptionId?: string; stage: number; dueAt: string; status: 'scheduled' | 'done'; reason: string; completedAt?: string };

export type MentorRoadmap = {
	source: 'ai' | 'curated';
	title: string;
	objective: string;
	prerequisites: string[];
	difficulty: string;
	finalProject: string;
	modules: { title: string; lessonIds: string[]; note?: string }[];
	rules: { hintsAllowed: number; passScore: number; openOrder: boolean; depth: string };
	aiNote?: string;
};

export type MentorState = {
	version: 1;
	verified?: boolean;
	id: string;
	projectId: string;
	language: string;
	level: 'beginner' | 'intermediate' | 'advanced';
	roadmap: MentorRoadmap;
	currentLessonId: string;
	lessons: Record<string, MentorLessonProgress>;
	attempts: { id: string; ts: string; lessonId: string; exerciseId: string; mode: 'run' | 'submit'; results: MentorTestResult[]; assessment?: MentorAssessment; hintsUsed: number }[];
	competencies: Record<string, MentorCompetency>;
	misconceptions: Record<string, MentorMisconception>;
	revisions: MentorRevision[];
	events: { ts: string; type: string; detail: string }[];
	createdAt: string;
	updatedAt: string;
};

export type MentorActivity = {
	sessionId: string;
	kind: 'watch_started' | 'file_save' | 'diagnostics' | 'watch_stopped';
	at: string;
	file: { path: string; language: string; lines: number };
	code?: string;
	diagnostics?: { line: number; message: string; severity: 'error' | 'warning' }[];
};

export type MentorAskKind = 'simpler' | 'another_example' | 'why_works' | 'similar_problem' | 'explain_mistake' | 'hint' | 'chat';

export class MentorApiError extends Error {
	public constructor(message: string, public readonly status: number) { super(message); }
}

export class MentorClient {
	private baseUrl: string;
	public constructor(baseUrl: string) { this.baseUrl = baseUrl.replace(/\/$/, ''); }
	public setBaseUrl(baseUrl: string) { this.baseUrl = baseUrl.replace(/\/$/, ''); }
	public getBaseUrl() { return this.baseUrl; }

	private async request<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; token?: string; timeoutMs?: number } = {}): Promise<T> {
		const headers: Record<string, string> = { 'content-type': 'application/json' };
		if (init.token) headers['authorization'] = `Bearer ${init.token}`;
		let response: Response;
		try {
			response = await fetch(this.baseUrl + path, {
				method: init.method ?? 'POST',
				headers,
				...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
				signal: AbortSignal.timeout(init.timeoutMs ?? 45000),
			});
		} catch {
			throw new MentorApiError('Could not reach the BuildMyLogic server. Check your connection and the API address.', 0);
		}
		const data = (await response.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
		if (!response.ok || !data || data.ok === false) {
			throw new MentorApiError(data?.error || `BuildMyLogic mentor request failed (${response.status}).`, response.status);
		}
		return data;
	}

	/** Public trial run: real execution on the Judge0 sandbox, never graded or stored. */
	public run(code: string, stdins: string[]) {
		return this.request<{ items: MentorRunItem[]; sandbox?: string }>('/api/mentor/run', { body: { code, stdins }, token: undefined, timeoutMs: 60000 });
	}

	public latest(token: string) {
		return this.request<{ state: MentorState | null }>('/api/mentor/sessions/latest', { method: 'GET', token, timeoutMs: 15000 });
	}

	public start(token: string, level: 'beginner' | 'intermediate' | 'advanced') {
		return this.request<{ state: MentorState }>('/api/mentor/start', { body: { projectId: 'arithmetic-c', language: 'C', level }, token, timeoutMs: 60000 });
	}

	public selectLesson(token: string, sessionId: string, lessonId: string) {
		return this.request<{ state: MentorState }>('/api/mentor/select-lesson', { body: { sessionId, lessonId }, token, timeoutMs: 15000 });
	}

	public hint(token: string, sessionId: string, lessonId: string, revisionId?: string) {
		return this.request<{ hint: string; state: MentorState }>('/api/mentor/hint', { body: { sessionId, lessonId, ...(revisionId ? { revisionId } : {}) }, token, timeoutMs: 15000 });
	}

	public submit(token: string, sessionId: string, lessonId: string, exerciseId: string, code: string, revisionId?: string) {
		return this.request<{ results: MentorTestResult[]; assessment: MentorAssessment; decision: string; state: MentorState }>(
			'/api/mentor/submit',
			{ body: { sessionId, lessonId, exerciseId, code, ...(revisionId ? { revisionId } : {}) }, token, timeoutMs: 90000 },
		);
	}

	/** Task-aware mentor chat. Requires the web worker's /api/mentor/ask route. */
	public ask(token: string, payload: {
		kind: MentorAskKind; level: string; lessonTitle: string; objective: string; exercisePrompt: string; code: string;
		lastFeedback: string; misconceptions: string[]; hintsUsed: number; message: string;
	}) {
		return this.request<{ message: string }>('/api/mentor/ask', { body: payload, token, timeoutMs: 60000 });
	}

	/** Activity sync for the learning watcher. Requires the web worker's /api/mentor/activity route. */
	public activity(token: string, payload: MentorActivity) {
		return this.request<{ note?: string }>('/api/mentor/activity', { body: payload, token, timeoutMs: 20000 });
	}

	/** Live curriculum metadata. Requires the web worker's /api/mentor/lessons route. */
	public lessons(token: string) {
		return this.request<{ lessons: unknown[]; remedials: Record<string, unknown> }>('/api/mentor/lessons', { method: 'GET', token, timeoutMs: 15000 });
	}
}
