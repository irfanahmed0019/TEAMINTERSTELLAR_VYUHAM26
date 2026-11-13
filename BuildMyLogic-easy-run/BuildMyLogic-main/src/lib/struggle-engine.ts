/**
 * BuildMyLogic — Struggle Engine (deterministic core)
 *
 * Turns real graded practice attempts into the Fail → Diagnose → Adapt →
 * Reassess → Conquer loop from the product vision:
 *
 * - Every Submit outcome is recorded as a PracticeAttempt with a failure
 *   signature built from the actual failing tests and error kind.
 * - The same signature failing 2+ times locks a Misconception (Diagnose).
 *   Syntax/runtime repeats are labelled slips (careless); logic/edge-case
 *   repeats are labelled deep (conceptual). The label only ever describes
 *   observed output, never a guessed mental state.
 * - A locked misconception produces a targeted challenge (Adapt) derived
 *   from the real failing test.
 * - A later full pass on the same topic conquers the misconception
 *   (Reassess → Conquer), which feeds the celebration, the Failure Replay
 *   and the Proof of Struggle portfolio.
 *
 * Everything here is pure and deterministic so it is unit-testable and never
 * invents progress: no attempt recorded, no evidence.
 */

export type FailureKind = "syntax" | "runtime" | "edge_case" | "logic";
export type MisconceptionDepth = "slip" | "deep";

export type PracticeAttempt = {
  id: string;
  topicId: string;
  topicTitle: string;
  language: string;
  exerciseTitle: string;
  at: number;
  passed: number;
  total: number;
  fullPass: boolean;
  kind: FailureKind | null;
  failingTests: string[];
  signature: string | null;
  /** Last visible failing example (never from hidden tests). */
  example?: { testName: string; expected: string; actual: string } | undefined;
};

export type TargetedChallenge = {
  title: string;
  task: string;
  check: string;
};

export type Misconception = {
  id: string;
  topicId: string;
  topicTitle: string;
  language: string;
  signature: string;
  summary: string;
  kind: FailureKind;
  depth: MisconceptionDepth;
  firstSeenAt: number;
  lastSeenAt: number;
  occurrences: number;
  status: "watching" | "locked" | "conquered";
  lockedAt?: number | undefined;
  conqueredAt?: number | undefined;
  /** Failing submissions between first sight and the conquering pass. */
  failuresToConquer?: number | undefined;
  /** Milliseconds from first failing attempt to the conquering pass. */
  timeToConquerMs?: number | undefined;
  targetedChallenge?: TargetedChallenge | undefined;
  example?: { testName: string; expected: string; actual: string } | undefined;
};

export type StruggleState = {
  attempts: PracticeAttempt[];
  misconceptions: Misconception[];
  /** Conquered misconception ids whose celebration has already been shown. */
  celebratedIds: string[];
};

export const emptyStruggleState: StruggleState = {
  attempts: [],
  misconceptions: [],
  celebratedIds: [],
};

const MAX_ATTEMPTS = 120;
const LOCK_THRESHOLD = 2;

export const KIND_LABEL: Record<FailureKind, string> = {
  syntax: "code that doesn't compile",
  runtime: "crashes while running",
  edge_case: "edge cases",
  logic: "output that doesn't match the goal",
};

export function kindLabel(kind: FailureKind): string {
  return KIND_LABEL[kind];
}

const EDGE_NAME =
  /edge|zero|empty|negative|boundar|large|single|invalid|max|min|one\b/i;

/**
 * Classifies one failing test result from its real execution status and
 * output. Judge0 status strings drive syntax/runtime; wrong answers are
 * split into edge-case vs logic from the test name and how close the actual
 * output is to the expected one.
 */
export function classifyFailure(result: {
  name: string;
  expected: string;
  actual: string;
  status: string;
  stderr: string;
}): FailureKind {
  const status = result.status.toLowerCase();
  if (status.includes("compilation")) return "syntax";
  if (
    status.includes("runtime") ||
    status.includes("time limit") ||
    status.includes("killed")
  )
    return "runtime";
  if (EDGE_NAME.test(result.name)) return "edge_case";
  const expectedLines = result.expected
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const actualLines = result.actual
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (expectedLines.length > 0 && actualLines.length > 0) {
    const shared = expectedLines.filter((l) => actualLines.includes(l)).length;
    if (shared / expectedLines.length >= 0.5) return "edge_case";
    // Nearly-equal numeric output (off-by-one style) is an edge-case slip.
    const numericExpected = expectedLines.every(
      (l) => !Number.isNaN(Number(l)),
    );
    const numericActual = actualLines.every((l) => !Number.isNaN(Number(l)));
    if (
      numericExpected &&
      numericActual &&
      expectedLines.length === actualLines.length
    ) {
      const close = expectedLines.every(
        (l, i) => Math.abs(Number(l) - Number(actualLines[i])) <= 1,
      );
      if (close) return "edge_case";
    }
  }
  return "logic";
}

/** Stable signature: same failing tests + same kind = same struggle. */
export function failureSignature(
  kind: FailureKind,
  failingTests: string[],
): string {
  return `${kind}:${failingTests
    .map((t) => t.toLowerCase().trim())
    .sort()
    .join("|")}`;
}

/** Honest, data-bound label: names the observed behaviour, not a mind state. */
export function summarizeMisconception(
  kind: FailureKind,
  failingTests: string[],
  topicTitle: string,
): string {
  const test = failingTests[0] ?? "the checks";
  switch (kind) {
    case "syntax":
      return `Repeating compile errors in ${topicTitle}`;
    case "runtime":
      return `Repeating crashes on "${test}" in ${topicTitle}`;
    case "edge_case":
      return `Main case works but "${test}" keeps failing in ${topicTitle}`;
    case "logic":
      return `Output for "${test}" keeps missing the goal in ${topicTitle}`;
  }
}

/** Adapt step: one focused challenge derived from the real failing test. */
export function buildTargetedChallenge(
  kind: FailureKind,
  failingTests: string[],
  topicTitle: string,
  hint: string,
): TargetedChallenge {
  const test = failingTests[0] ?? "the failing check";
  switch (kind) {
    case "syntax":
      return {
        title: `Targeted fix: make it compile`,
        task: `Your ${topicTitle} code failed to compile more than once. Rebuild it in the smallest pieces: write an empty main that compiles, then add one line at a time and Run after each. The line that breaks it is your bug.`,
        check: hint,
      };
    case "runtime":
      return {
        title: `Targeted fix: stop the crash`,
        task: `"${test}" crashes your program. Before the crashing line, print the values it uses. One of them is not what you think - guard or fix that value, then re-run.`,
        check: hint,
      };
    case "edge_case":
      return {
        title: `Targeted fix: "${test}"`,
        task: `Your main logic works but "${test}" keeps failing. Write the smallest program that handles exactly that case on its own. When it passes, merge that handling back into your full solution.`,
        check: hint,
      };
    case "logic":
      return {
        title: `Targeted fix: "${test}"`,
        task: `For "${test}", trace your code with pen and paper: write what each variable holds after every line, then compare with what the task needs. Fix the first line where the two disagree.`,
        check: hint,
      };
  }
}

export type GradedResult = {
  name: string;
  hidden: boolean;
  passed: boolean;
  expected: string;
  actual: string;
  status: string;
  stderr: string;
};

export type RecordOutcome = {
  attempt: PracticeAttempt;
  locked: Misconception | null;
  conquered: Misconception | null;
};

let counter = 0;

/**
 * Records one graded Submit outcome against the struggle state. Pure: takes
 * and returns state, plus the events the UI should react to (a new lock to
 * show the targeted challenge, a conquer to celebrate).
 */
export function recordPracticeAttempt(
  prev: StruggleState,
  input: {
    topicId: string;
    topicTitle: string;
    language: string;
    exerciseTitle: string;
    exerciseHint: string;
    graded: GradedResult[];
    at?: number;
  },
): { state: StruggleState; outcome: RecordOutcome } {
  const at = input.at ?? Date.now();
  const total = input.graded.length;
  const failing = input.graded.filter((g) => !g.passed);
  const fullPass = total > 0 && failing.length === 0;
  const kind = failing.length ? classifyFailure(failing[0]!) : null;
  const failingTests = failing.map((g) => g.name);
  const signature = kind ? failureSignature(kind, failingTests) : null;
  const exampleFail = failing.find((g) => !g.hidden);

  counter += 1;
  const attempt: PracticeAttempt = {
    id: `${input.topicId}:${input.language}:${at}:${counter}`,
    topicId: input.topicId,
    topicTitle: input.topicTitle,
    language: input.language,
    exerciseTitle: input.exerciseTitle,
    at,
    passed: total - failing.length,
    total,
    fullPass,
    kind,
    failingTests,
    signature,
    example: exampleFail
      ? {
          testName: exampleFail.name,
          expected: exampleFail.expected,
          actual: exampleFail.actual,
        }
      : undefined,
  };

  let misconceptions = [...prev.misconceptions];
  let locked: Misconception | null = null;
  let conquered: Misconception | null = null;

  if (fullPass) {
    // Reassess → Conquer: a real full pass on this topic+language resolves
    // its open misconceptions. Only a locked one earns the celebration; a
    // single earlier slip is quietly closed.
    misconceptions = misconceptions.map((m) => {
      if (m.status === "conquered") return m;
      if (m.topicId !== input.topicId || m.language !== input.language)
        return m;
      const done: Misconception = {
        ...m,
        status: "conquered",
        conqueredAt: at,
        failuresToConquer: m.occurrences,
        timeToConquerMs: at - m.firstSeenAt,
      };
      if (m.status === "locked" && !conquered) conquered = done;
      return done;
    });
  } else if (signature && kind) {
    const existingIndex = misconceptions.findIndex(
      (m) =>
        m.signature === signature &&
        m.topicId === input.topicId &&
        m.language === input.language &&
        m.status !== "conquered",
    );
    if (existingIndex >= 0) {
      const existing = misconceptions[existingIndex]!;
      const occurrences = existing.occurrences + 1;
      const updated: Misconception = {
        ...existing,
        occurrences,
        lastSeenAt: at,
        example: attempt.example ?? existing.example,
        ...(existing.status === "watching" && occurrences >= LOCK_THRESHOLD
          ? {
              status: "locked" as const,
              lockedAt: at,
              targetedChallenge: buildTargetedChallenge(
                kind,
                failingTests,
                input.topicTitle,
                input.exerciseHint,
              ),
            }
          : {}),
      };
      misconceptions[existingIndex] = updated;
      if (updated.status === "locked" && existing.status === "watching")
        locked = updated;
    } else {
      const fresh: Misconception = {
        id: `mc:${input.topicId}:${input.language}:${signature}`,
        topicId: input.topicId,
        topicTitle: input.topicTitle,
        language: input.language,
        signature,
        summary: summarizeMisconception(kind, failingTests, input.topicTitle),
        kind,
        depth: kind === "syntax" || kind === "runtime" ? "slip" : "deep",
        firstSeenAt: at,
        lastSeenAt: at,
        occurrences: 1,
        status: LOCK_THRESHOLD <= 1 ? "locked" : "watching",
        example: attempt.example,
      };
      misconceptions = [fresh, ...misconceptions];
    }
  }

  const state: StruggleState = {
    attempts: [attempt, ...prev.attempts].slice(0, MAX_ATTEMPTS),
    misconceptions: misconceptions.slice(0, 40),
    celebratedIds: prev.celebratedIds,
  };
  return { state, outcome: { attempt, locked, conquered } };
}

/** Marks a conquered misconception's celebration as shown. */
export function markCelebrated(prev: StruggleState, id: string): StruggleState {
  return { ...prev, celebratedIds: [...new Set([...prev.celebratedIds, id])] };
}

/** The next conquered-and-locked misconception still waiting for its moment. */
export function pendingCelebration(prev: StruggleState): Misconception | null {
  return (
    prev.misconceptions.find(
      (m) =>
        m.status === "conquered" &&
        m.depth === "deep" &&
        (m.failuresToConquer ?? 0) >= LOCK_THRESHOLD &&
        !prev.celebratedIds.includes(m.id),
    ) ?? null
  );
}

// ── Struggle DNA (all figures computed from recorded attempts only) ──────────

export type TopicStruggle = {
  topicId: string;
  topicTitle: string;
  fails: number;
  passes: number;
  kinds: Partial<Record<FailureKind, number>>;
  topKind: FailureKind | null;
  activeMisconceptions: number;
  conquered: number;
};

export function struggleByTopic(prev: StruggleState): TopicStruggle[] {
  const map = new Map<string, TopicStruggle>();
  for (const a of prev.attempts) {
    const row = map.get(a.topicId) ?? {
      topicId: a.topicId,
      topicTitle: a.topicTitle,
      fails: 0,
      passes: 0,
      kinds: {},
      topKind: null,
      activeMisconceptions: 0,
      conquered: 0,
    };
    if (a.fullPass) row.passes += 1;
    else {
      row.fails += 1;
      if (a.kind) row.kinds[a.kind] = (row.kinds[a.kind] ?? 0) + 1;
    }
    map.set(a.topicId, row);
  }
  for (const m of prev.misconceptions) {
    const row = map.get(m.topicId);
    if (!row) continue;
    if (m.status === "conquered") row.conquered += 1;
    else row.activeMisconceptions += 1;
  }
  for (const row of map.values()) {
    const entries = Object.entries(row.kinds) as [FailureKind, number][];
    row.topKind = entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  return [...map.values()].sort(
    (a, b) => b.fails - a.fails || b.passes - a.passes,
  );
}

export type StruggleMetrics = {
  totalAttempts: number;
  totalFails: number;
  lockedCount: number;
  conqueredCount: number;
  /** % of locked misconceptions that were later conquered. */
  conquerRate: number | null;
  /** Average ms from first failure to conquering pass. */
  avgTimeToConquerMs: number | null;
  /**
   * Share of recent failures that repeated an already-seen signature vs the
   * earliest failures. Falling repeats = the loop is working.
   */
  repeatShareEarly: number | null;
  repeatShareRecent: number | null;
};

export function struggleMetrics(prev: StruggleState): StruggleMetrics {
  const fails = prev.attempts.filter((a) => !a.fullPass);
  const locked = prev.misconceptions.filter(
    (m) =>
      m.status === "locked" ||
      (m.status === "conquered" &&
        (m.failuresToConquer ?? 0) >= LOCK_THRESHOLD),
  );
  const conquered = prev.misconceptions.filter((m) => m.status === "conquered");
  const conqueredLocked = conquered.filter(
    (m) => (m.failuresToConquer ?? 0) >= LOCK_THRESHOLD,
  );
  const times = conqueredLocked
    .map((m) => m.timeToConquerMs)
    .filter((v): v is number => typeof v === "number");

  const repeatShare = (slice: PracticeAttempt[]): number | null => {
    const f = slice.filter((a) => !a.fullPass && a.signature);
    if (f.length < 2) return null;
    const repeats = f.filter((a) => {
      const firstSeen = prev.misconceptions.find(
        (m) => m.signature === a.signature,
      )?.firstSeenAt;
      return typeof firstSeen === "number" && a.at > firstSeen;
    }).length;
    return repeats / f.length;
  };
  // attempts are newest-first; early = tail, recent = head
  const early = fails.slice(-5);
  const recent = fails.slice(0, 5);

  return {
    totalAttempts: prev.attempts.length,
    totalFails: fails.length,
    lockedCount: locked.filter((m) => m.status === "locked").length,
    conqueredCount: conqueredLocked.length,
    conquerRate: locked.length ? conqueredLocked.length / locked.length : null,
    avgTimeToConquerMs: times.length
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : null,
    repeatShareEarly: repeatShare(early),
    repeatShareRecent: repeatShare(recent),
  };
}

/**
 * Measurable patterns only, phrased from counts. Never claims a thinking
 * style - just where the recorded failures cluster.
 */
export function strugglePatterns(prev: StruggleState): string[] {
  const fails = prev.attempts.filter((a) => !a.fullPass && a.kind);
  const patterns: string[] = [];
  if (fails.length >= 3) {
    const counts = new Map<FailureKind, number>();
    for (const f of fails) counts.set(f.kind!, (counts.get(f.kind!) ?? 0) + 1);
    const [kind, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
    if (count >= Math.ceil(fails.length / 2)) {
      patterns.push(
        `${count} of your last ${fails.length} failures were ${KIND_LABEL[kind]}.`,
      );
    }
  }
  const repeats = prev.misconceptions.filter(
    (m) => m.occurrences >= LOCK_THRESHOLD,
  );
  if (repeats.length > 0) {
    const worst = [...repeats].sort(
      (a, b) => b.occurrences - a.occurrences,
    )[0]!;
    patterns.push(
      `Your most repeated pattern: ${worst.summary} (${worst.occurrences} times).`,
    );
  }
  const metrics = struggleMetrics(prev);
  if (
    metrics.repeatShareEarly !== null &&
    metrics.repeatShareRecent !== null &&
    metrics.repeatShareRecent < metrics.repeatShareEarly
  ) {
    patterns.push(
      "Your recent failures repeat old patterns less often than your early ones.",
    );
  }
  return patterns;
}

/** Failure Replay: the honest before/after story of one conquered pattern. */
export function failureReplay(m: Misconception): {
  before: string;
  cause: string;
  after: string;
} {
  const before = m.example
    ? `"${m.example.testName}" kept failing${m.example.actual ? ` - your output was "${m.example.actual.slice(0, 80)}" against the goal "${m.example.expected.slice(0, 80)}"` : ""}.`
    : `${m.summary}.`;
  const cause = `The same pattern showed up ${m.failuresToConquer ?? m.occurrences} times across your submissions, so it was a ${m.depth === "deep" ? "conceptual gap" : "repeat slip"}, not bad luck.`;
  const mins =
    typeof m.timeToConquerMs === "number"
      ? Math.max(1, Math.round(m.timeToConquerMs / 60000))
      : null;
  const took =
    mins === null
      ? ""
      : mins < 60
        ? `, ${mins} min after the first failure`
        : `, ${Math.round(mins / 60)} h after the first failure`;
  const after = `Your latest attempt passed every check on ${m.topicTitle}${took}.`;
  return { before, cause, after };
}
