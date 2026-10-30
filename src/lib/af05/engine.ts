/**
 * AF-05 deterministic engine: competency scoring, misconception tracking,
 * revision scheduling and the orchestrator's next-intervention decision.
 *
 * Everything here is pure and evidence-driven. AI is only used (elsewhere,
 * through the Assessment/Learning agent server functions) for qualitative
 * feedback and explanation scoring; these functions never invent results.
 */
import type {
  Af05State,
  AssessmentRecord,
  Competency,
  CompetencyState,
  DiagnosticAnswer,
  Evidence,
  Misconception,
  OrchestratorDecision,
  Revision,
  SkillId,
} from "./types";
import { SKILL_LABELS } from "./types";
import { DIAGNOSTIC_ITEMS, itemsForTrack } from "./diagnostic";

/** Spaced-repetition defaults from the kernel (initial defaults, not universal). */
export const REVISION_INTERVALS_MS = [
  24 * 60 * 60 * 1000, // first reassessment: 24 hours
  3 * 24 * 60 * 60 * 1000, // second: 3 days
  7 * 24 * 60 * 60 * 1000, // third: 7 days
];

const MAX_EVIDENCE_PER_SKILL = 40;

function ensureCompetency(state: Af05State, skill: SkillId): Competency {
  const existing = state.competencies[skill];
  if (existing) return existing;
  const fresh: Competency = {
    skill,
    state: "not_assessed",
    score: 0,
    evidence: [],
    practicalPasses: 0,
    reassessmentPasses: 0,
  };
  state.competencies[skill] = fresh;
  return fresh;
}

/**
 * Recompute a competency from its evidence. Mastery deliberately requires
 * practical execution evidence AND at least one passed delayed reassessment,
 * so a single easy quiz can never award mastery (kernel section 4 step 8).
 */
export function recomputeCompetency(comp: Competency): Competency {
  const recent = comp.evidence.slice(-MAX_EVIDENCE_PER_SKILL);
  const earned = recent.reduce((sum, e) => sum + e.weight, 0);
  const possible = recent.length * 3;
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);

  let state: CompetencyState = "not_assessed";
  if (recent.length > 0) {
    if (
      score >= 80 &&
      comp.practicalPasses >= 1 &&
      comp.reassessmentPasses >= 1
    ) {
      state = "mastered";
    } else if (score >= 65 && comp.practicalPasses >= 1) {
      state = "proficient";
    } else if (score >= 35) {
      state = "developing";
    } else {
      state = "beginner";
    }
  }
  return { ...comp, score, state, evidence: recent };
}

export function recordEvidence(
  state: Af05State,
  skill: SkillId,
  evidence: Evidence,
): void {
  const comp = ensureCompetency(state, skill);
  comp.evidence = [...comp.evidence, evidence];
  comp.lastAssessedAt = evidence.at;
  if (
    (evidence.kind === "practical" || evidence.kind === "project_task") &&
    evidence.source === "execution" &&
    evidence.weight >= 3
  ) {
    comp.practicalPasses += 1;
  }
  if (evidence.kind === "reassessment" && evidence.weight >= 2) {
    comp.reassessmentPasses += 1;
  }
  state.competencies[skill] = recomputeCompetency(comp);
}

export function recordMisconception(
  state: Af05State,
  skill: SkillId,
  misconception: { id: string; label: string },
  severity: Misconception["severity"] = "medium",
): Misconception {
  const now = Date.now();
  const existing = state.misconceptions[misconception.id];
  if (existing) {
    existing.count += 1;
    existing.lastSeenAt = now;
    existing.status = "active";
    if (severity === "high") existing.severity = "high";
    return existing;
  }
  const created: Misconception = {
    id: misconception.id,
    label: misconception.label,
    skill,
    severity,
    count: 1,
    firstSeenAt: now,
    lastSeenAt: now,
    status: "active",
  };
  state.misconceptions[misconception.id] = created;
  return created;
}

export function scheduleRevision(
  state: Af05State,
  skill: SkillId,
  concept: string,
  misconceptionId?: string,
): Revision {
  const now = Date.now();
  // Reuse an open revision for the same concept instead of duplicating.
  const open = state.revisions.find(
    (r) =>
      r.status === "scheduled" &&
      r.skill === skill &&
      r.concept === concept &&
      r.misconceptionId === misconceptionId,
  );
  if (open) return open;
  const revision: Revision = {
    id: `rev-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    skill,
    concept,
    misconceptionId,
    createdAt: now,
    dueAt: now + REVISION_INTERVALS_MS[0]!,
    stage: 0,
    status: "scheduled",
  };
  state.revisions.push(revision);
  return revision;
}

/** A passed reassessment advances the schedule; a failed one restarts it. */
export function completeRevision(
  state: Af05State,
  revisionId: string,
  passed: boolean,
): void {
  const found = state.revisions.find((r) => r.id === revisionId);
  if (!found || found.status !== "scheduled") return;
  const revision = found;
  const now = Date.now();
  if (passed) {
    if (revision.stage >= REVISION_INTERVALS_MS.length - 1) {
      revision.status = "completed";
      revision.completedAt = now;
      if (revision.misconceptionId) {
        const mis = state.misconceptions[revision.misconceptionId];
        if (mis) mis.status = "resolved";
      }
      return;
    }
    revision.stage += 1;
    revision.dueAt =
      now +
      (REVISION_INTERVALS_MS[revision.stage] ?? REVISION_INTERVALS_MS[0]!);
  } else {
    revision.stage = 0;
    revision.dueAt = now + REVISION_INTERVALS_MS[0]!;
    const comp = state.competencies[revision.skill];
    if (comp && comp.reassessmentPasses > 0) comp.reassessmentPasses -= 1;
    if (comp) state.competencies[revision.skill] = recomputeCompetency(comp);
  }
}

export function dueRevisions(state: Af05State, now = Date.now()): Revision[] {
  return state.revisions
    .filter((r) => r.status === "scheduled" && r.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function upcomingRevisions(
  state: Af05State,
  now = Date.now(),
): Revision[] {
  return state.revisions
    .filter((r) => r.status === "scheduled" && r.dueAt > now)
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function addHistory(state: Af05State, record: AssessmentRecord): void {
  state.assessmentHistory.push(record);
  if (state.assessmentHistory.length > 200) {
    state.assessmentHistory = state.assessmentHistory.slice(-200);
  }
}

function logDecision(state: Af05State, decision: OrchestratorDecision): void {
  state.decisions.push(decision);
  if (state.decisions.length > 100) {
    state.decisions = state.decisions.slice(-100);
  }
}

/**
 * The Orchestrator Agent (kernel section 5A): reads student state and picks
 * the single next learning intervention. Deterministic and explainable; the
 * reason is shown to the student.
 */
export function decideNext(
  state: Af05State,
  now = Date.now(),
  options: { record?: boolean } = {},
): OrchestratorDecision {
  const make = (d: Omit<OrchestratorDecision, "at">): OrchestratorDecision => {
    const decision = { ...d, at: now };
    // Reads for display (dashboard, learning path) must not spam the
    // decision log; only committed interventions are recorded.
    if (options.record ?? false) logDecision(state, decision);
    return decision;
  };

  if (!state.goalTrack) {
    return make({
      type: "select_goal",
      reason: "Choose a learning goal so the diagnostic can be personalised.",
    });
  }

  if (state.diagnostic.status !== "completed") {
    return make({
      type: "diagnostic",
      reason:
        state.diagnostic.status === "in_progress"
          ? "Finish the diagnostic assessment to complete your competency profile."
          : "Take the diagnostic assessment so gaps are measured, not guessed.",
    });
  }

  const due = dueRevisions(state, now);
  const dueFirst = due[0];
  if (dueFirst) {
    return make({
      type: "reassessment",
      revisionId: dueFirst.id,
      skill: dueFirst.skill,
      reason: `A spaced reassessment on ${SKILL_LABELS[dueFirst.skill]} (${dueFirst.concept.replaceAll("_", " ")}) is due. Delayed recall is what proves retention.`,
    });
  }

  const activeMisconception = Object.values(state.misconceptions)
    .filter((m) => m.status === "active")
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      return rank[a.severity] - rank[b.severity] || b.lastSeenAt - a.lastSeenAt;
    })[0];
  if (activeMisconception && activeMisconception.count >= 2) {
    return make({
      type: "targeted_practice",
      skill: activeMisconception.skill,
      reason: `You have hit "${activeMisconception.label}" ${activeMisconception.count} times. Targeted practice will fix the underlying concept.`,
    });
  }

  if (!state.activeProjectId) {
    return make({
      type: "project_recommendation",
      reason:
        "Your competency profile is ready. Pick a recommended project to build real evidence.",
    });
  }

  const progress = state.projectProgress[state.activeProjectId];
  const nextTask = progress
    ? Object.entries(progress.tasks).find(([, t]) => t.status === "active")
    : undefined;
  if (nextTask) {
    return make({
      type: "project_task",
      projectId: state.activeProjectId,
      taskId: nextTask[0],
      reason:
        "Continue your active project - the next task builds on what you have already shown.",
    });
  }

  return make({
    type: "explore",
    reason:
      "Solid progress. Pick another project or practise in the Debug Lab.",
  });
}

export type GapReport = {
  skill: SkillId;
  label: string;
  state: CompetencyState;
  score: number;
  assessed: boolean;
  activeMisconceptions: Misconception[];
};

/** Skill gap analysis (kernel step 3): unassessed is distinct from weak. */
export function gapAnalysis(state: Af05State): GapReport[] {
  const track = state.goalTrack ?? "fullstack";
  const skills = itemsForTrack(track).map((item) => item.skill);
  const uniqueSkills = [...new Set(skills)];
  return uniqueSkills.map((skill) => {
    const comp = state.competencies[skill];
    return {
      skill,
      label: SKILL_LABELS[skill],
      state: comp?.state ?? "not_assessed",
      score: comp?.score ?? 0,
      assessed: Boolean(comp && comp.evidence.length > 0),
      activeMisconceptions: Object.values(state.misconceptions).filter(
        (m) => m.skill === skill && m.status === "active",
      ),
    };
  });
}

/** Score one objective diagnostic answer deterministically. */
export function gradeObjectiveAnswer(
  itemId: string,
  choiceId: string,
): Pick<DiagnosticAnswer, "correct" | "misconceptionId"> & {
  misconceptionLabel?: string | undefined;
} {
  const item = DIAGNOSTIC_ITEMS.find((i) => i.id === itemId);
  const choice = item?.choices?.find((c) => c.id === choiceId);
  if (!item || !choice) return { correct: false };
  return {
    correct: Boolean(choice.correct),
    misconceptionId: choice.correct ? undefined : choice.misconception?.id,
    misconceptionLabel: choice.correct
      ? undefined
      : choice.misconception?.label,
  };
}

/** Deterministic keyword fallback for explanation items when the AI rubric is unavailable. */
export function keywordScoreExplanation(itemId: string, text: string): number {
  const item = DIAGNOSTIC_ITEMS.find((i) => i.id === itemId);
  if (!item?.keywords?.length) return 0;
  const haystack = text.toLowerCase();
  const hits = item.keywords.filter((k) =>
    haystack.includes(k.toLowerCase()),
  ).length;
  const ratio = hits / Math.min(item.keywords.length, 5);
  if (text.trim().length < 20) return 0;
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  if (ratio >= 0.25) return 1;
  return 0;
}
