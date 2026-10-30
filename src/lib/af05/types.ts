/**
 * AF-05 Adaptive Learning & Competency Assessment - core domain types.
 *
 * The orchestrator, learning agent and assessment agent exchange these
 * structured contracts. Competency changes are only ever driven by recorded
 * evidence (execution results, deterministic checks or validated AI rubric
 * scores), never by UI completion alone.
 */

export type SkillId =
  "html" | "css" | "javascript" | "react" | "backend" | "databases" | "apis";

export const SKILL_LABELS: Record<SkillId, string> = {
  html: "HTML",
  css: "CSS",
  javascript: "JavaScript",
  react: "React",
  backend: "Backend development",
  databases: "Database fundamentals",
  apis: "API development",
};

export const COMPETENCY_STATES = [
  "not_assessed",
  "beginner",
  "developing",
  "proficient",
  "mastered",
] as const;
export type CompetencyState = (typeof COMPETENCY_STATES)[number];

export const COMPETENCY_LABELS: Record<CompetencyState, string> = {
  not_assessed: "Not assessed",
  beginner: "Beginner",
  developing: "Developing",
  proficient: "Proficient",
  mastered: "Mastered",
};

export type EvidenceSource = "execution" | "deterministic" | "ai_rubric";

export type Evidence = {
  at: number;
  kind:
    | "diagnostic"
    | "explanation"
    | "practical"
    | "project_task"
    | "reassessment";
  summary: string;
  /** 0-3 contribution toward the skill score. */
  weight: number;
  source: EvidenceSource;
};

export type Misconception = {
  id: string;
  label: string;
  skill: SkillId;
  severity: "low" | "medium" | "high";
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  status: "active" | "resolved";
};

export type AssessmentRecord = {
  at: number;
  kind: "diagnostic" | "practical" | "reassessment" | "project_task";
  skill: SkillId;
  result: "pass" | "partial" | "fail";
  detail: string;
};

export type Competency = {
  skill: SkillId;
  state: CompetencyState;
  /** 0-100 deterministic aggregate of evidence weights. */
  score: number;
  evidence: Evidence[];
  lastAssessedAt?: number;
  practicalPasses: number;
  reassessmentPasses: number;
};

export type Revision = {
  id: string;
  skill: SkillId;
  concept: string;
  misconceptionId?: string | undefined;
  createdAt: number;
  dueAt: number;
  /** 0 -> +24h, 1 -> +3d, 2 -> +7d (configurable defaults, see engine). */
  stage: number;
  status: "scheduled" | "completed" | "lapsed";
  completedAt?: number;
};

export type DiagnosticAnswer = {
  itemId: string;
  at: number;
  /** choice id for objective items, text for explanations, code for practicals */
  response: string;
  correct?: boolean | undefined;
  /** 0-3 rubric score for AI/keyword-scored explanations */
  score?: number | undefined;
  scoreSource?: EvidenceSource | undefined;
  testsPassed?: number | undefined;
  testsTotal?: number | undefined;
  misconceptionId?: string | undefined;
};

export type DiagnosticStatus = {
  status: "not_started" | "in_progress" | "completed";
  track?: string;
  startedAt?: number;
  completedAt?: number;
  answers: Record<string, DiagnosticAnswer>;
};

export type ProjectTaskProgress = {
  status: "locked" | "active" | "done";
  completedAt?: number;
  note?: string;
  attempts: number;
  lastTestScore?: { passed: number; total: number };
};

export type ProjectProgress = {
  startedAt: number;
  tasks: Record<string, ProjectTaskProgress>;
  completedAt?: number;
};

/** Structured contract between agents (kernel section 5). */
export type AgentObservation = {
  student_id: string;
  skill: SkillId;
  evidence: string;
  misconception?: string;
  severity: "low" | "medium" | "high";
  recommended_action: "advance" | "targeted_practice" | "revision" | "reassess";
};

export type AssessmentAgentResult = {
  score: number; // 0-3 rubric
  feedback: string;
  strengths: string[];
  improvements: string[];
  misconception?:
    | { id: string; label: string; severity: "low" | "medium" | "high" }
    | undefined;
  recommended_action: AgentObservation["recommended_action"];
};

export type OrchestratorDecision = {
  at: number;
  type:
    | "select_goal"
    | "diagnostic"
    | "project_recommendation"
    | "project_task"
    | "targeted_practice"
    | "revision"
    | "reassessment"
    | "explore";
  reason: string;
  skill?: SkillId;
  projectId?: string;
  taskId?: string;
  revisionId?: string;
};

export type Af05State = {
  goalTrack?: string;
  diagnostic: DiagnosticStatus;
  competencies: Partial<Record<SkillId, Competency>>;
  misconceptions: Record<string, Misconception>;
  assessmentHistory: AssessmentRecord[];
  revisions: Revision[];
  decisions: OrchestratorDecision[];
  activeProjectId?: string;
  projectProgress: Record<string, ProjectProgress>;
};

export const emptyAf05: Af05State = {
  diagnostic: { status: "not_started", answers: {} },
  competencies: {},
  misconceptions: {},
  assessmentHistory: [],
  revisions: [],
  decisions: [],
  projectProgress: {},
};
