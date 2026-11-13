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

export type FailureKind =
  "syntax" | "runtime" | "edge_case" | "logic" | "formatting";
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
  /** Where this evidence came from: in-app practice, VS Code, or a reassessment. */
  source?: "practice" | "vscode" | "reassessment" | undefined;
};

export type TargetedChallenge = {
  title: string;
  task: string;
  check: string;
};

export type ReassessmentTest = {
  name: string;
  stdin: string;
  expected: string;
  /** Set when this check is a fresh deterministic variant of a seen test. */
  variantOf?: string | undefined;
  /** True for checks the learner had never been shown before. */
  unseen?: boolean | undefined;
};

/**
 * The targeted reassessment behind Adapt → Reassess: a fresh, smaller program
 * graded on checks the learner has not seen verbatim (deterministic input
 * variants and/or previously hidden checks), plus an optional construct the
 * code must genuinely use so pasting the expected output cannot pass.
 */
export type Reassessment = {
  title?: string | undefined;
  task?: string | undefined;
  version?: string | undefined;
  tests: ReassessmentTest[];
  createdAt: number;
  attempts: number;
  constructLabel?: string | null | undefined;
  constructRegex?: string | null | undefined;
  constructSelfCall?: boolean | null | undefined;
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
  /** Elapsed wall-clock ms between the first recorded failure and the
   *  conquering pass. Not a measure of active learning time. */
  timeToConquerMs?: number | undefined;
  targetedChallenge?: TargetedChallenge | undefined;
  example?: { testName: string; expected: string; actual: string } | undefined;
  /** The fresh-check reassessment built for this pattern, once created. */
  reassessment?: Reassessment | undefined;
  /** True only when the conquer came from a passed reassessment after the lock. */
  reassessed?: boolean | undefined;
  /** Exact concept metadata from a connected VS Code session, not a guessed stack keyword. */
  transferTopicId?: string | undefined;
  sourceSessionId?: string | undefined;
  diagnosis?: DiagnosticEvidence | undefined;
};

export type StruggleState = {
  attempts: PracticeAttempt[];
  misconceptions: Misconception[];
  /** Conquered misconception ids whose celebration has already been shown. */
  celebratedIds: string[];
  /** Dedupe keys of VS Code build sessions already fed into the engine. */
  ingestedSessions: string[];
};

export const emptyStruggleState: StruggleState = {
  attempts: [],
  misconceptions: [],
  celebratedIds: [],
  ingestedSessions: [],
};

const MAX_ATTEMPTS = 120;
const LOCK_THRESHOLD = 2;

export const KIND_LABEL: Record<FailureKind, string> = {
  syntax: "code that doesn't compile",
  runtime: "crashes while running",
  edge_case: "edge cases",
  logic: "output that doesn't match the goal",
  formatting: "letter case or spacing differences",
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
  // A mismatch that disappears under case/whitespace folding is a
  // formatting slip, not a conceptual misunderstanding - say so honestly.
  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  if (
    result.expected.trim() !== "" &&
    squash(result.expected) === squash(result.actual) &&
    result.expected !== result.actual
  )
    return "formatting";
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
      return `Repeated failure on "${test}" in ${topicTitle}`;
    case "logic":
      return `Output for "${test}" keeps missing the goal in ${topicTitle}`;
    case "formatting":
      return `Output for "${test}" differs only in letter case or spacing in ${topicTitle}`;
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
        task: `"${test}" crashes your program. Before the crashing line, print the values it uses. Compare those values with the task requirements, then re-run after your fix.`,
        check: hint,
      };
    case "edge_case":
      return {
        title: `Targeted fix: "${test}"`,
        task: `The check "${test}" keeps failing. Write the smallest program that handles exactly that case on its own. When it passes, merge that handling back into your full solution.`,
        check: hint,
      };
    case "logic":
      return {
        title: `Targeted fix: "${test}"`,
        task: `For "${test}", trace your code with pen and paper: write what each variable holds after every line, then compare with what the task needs. Fix the first line where the two disagree.`,
        check: hint,
      };
    case "formatting":
      return {
        title: `Targeted fix: exact output format`,
        task: `"${test}" failed even though your values look right - the only difference is letter case or spacing. Put your output and the expected text side by side and match every character exactly, including capitals and spaces.`,
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
    source?: "practice" | "vscode" | "reassessment";
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
    source: input.source ?? "practice",
  };

  let misconceptions = [...prev.misconceptions];
  let locked: Misconception | null = null;
  const conquered: Misconception | null = null;

  if (fullPass) {
    // A full pass on the regular exercise is real progress and stays on the
    // record, but it does NOT conquer a locked pattern: the same submit can
    // repeat a memorised fix, so Conquer is gated on the pattern's targeted
    // reassessment (fresh checks after the lock - recordReassessmentAttempt).
    // Only unconfirmed "watching" entries close quietly here.
    misconceptions = misconceptions.map((m) => {
      if (m.status !== "watching") return m;
      if (m.topicId !== input.topicId || m.language !== input.language)
        return m;
      return {
        ...m,
        status: "conquered" as const,
        conqueredAt: at,
        failuresToConquer: m.occurrences,
        timeToConquerMs: at - m.firstSeenAt,
      };
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
        depth:
          kind === "syntax" || kind === "runtime" || kind === "formatting"
            ? "slip"
            : "deep",
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
    ingestedSessions: prev.ingestedSessions ?? [],
  };
  return { state, outcome: { attempt, locked, conquered } };
}

/** Deterministic fresh input: shifts every integer so the check is new. */
export function variantStdin(stdin: string): string {
  return stdin.replace(/-?\d+/g, (raw) => {
    const n = Number(raw);
    return String(n >= 0 ? n * 2 + 3 : n * 2 - 1);
  });
}

/** The failing test names recorded in a misconception's signature. */
export function signatureTests(signature: string): string[] {
  const i = signature.indexOf(":");
  return i < 0
    ? []
    : signature
        .slice(i + 1)
        .split("|")
        .filter(Boolean);
}

export type ReassessmentPlan = {
  /** Checks ready to grade as-is: the original failing checks plus any
   *  previously hidden ones the learner was never shown. */
  ready: ReassessmentTest[];
  /** Fresh input variants; expected output must come from running the
   *  exercise's reference solution on each new input. */
  pending: { name: string; stdin: string; variantOf: string }[];
};

/**
 * Builds the reassessment plan for a locked pattern from the exercise's real
 * tests: original failing checks stay (regression evidence), hidden checks
 * join as unseen evidence, and stdin-bearing checks get one deterministic
 * fresh-input variant each (expected computed from the reference solution).
 */
export function buildReassessmentPlan(
  m: Misconception,
  exerciseTests: {
    name: string;
    stdin: string;
    expected: string;
    hidden?: boolean;
  }[],
  hasSolution: boolean,
): ReassessmentPlan {
  const wanted = signatureTests(m.signature);
  const ready: ReassessmentTest[] = [];
  const pending: ReassessmentPlan["pending"] = [];
  for (const t of exerciseTests) {
    const isFailing = wanted.includes(t.name.toLowerCase().trim());
    if (isFailing) {
      ready.push({ name: t.name, stdin: t.stdin, expected: t.expected });
      if (hasSolution && /\d/.test(t.stdin)) {
        pending.push({
          name: `Fresh input variant of "${t.name}"`,
          stdin: variantStdin(t.stdin),
          variantOf: t.name,
        });
      }
    } else if (t.hidden) {
      ready.push({
        name: t.name,
        stdin: t.stdin,
        expected: t.expected,
        unseen: true,
      });
    }
  }
  return { ready, pending };
}

/**
 * Anti-hardcode construct check: the fresh program must genuinely use the
 * construct the pattern was about (a loop, an if, its own function, a
 * self-call), so pasting the expected output cannot pass the reassessment.
 */
export function constructSatisfied(
  construct:
    | {
        regex?: string | null | undefined;
        selfCall?: boolean | null | undefined;
      }
    | null
    | undefined,
  code: string,
): boolean {
  if (!construct) return true;
  if (construct.regex && !new RegExp(construct.regex, "m").test(code))
    return false;
  if (construct.selfCall) {
    const def = code.match(
      /(?:^|\n)\s*(?:def\s+(\w+)|(?:int|void|long|float|double|char)\s+(\w+)\s*\([^)]*\)\s*\{)/,
    );
    const name = def?.[1] ?? def?.[2];
    if (!name || name === "main") return false;
    const rest = code.slice(code.indexOf(name) + name.length);
    if (!new RegExp(`\\b${name}\\s*\\(`).test(rest)) return false;
  }
  return true;
}

/** Curated transfer tasks. Each changes the original task, not just its editor. */
export function newReassessment(
  topicId: string,
  language: string,
  at: number,
  diagnostic = false,
): Reassessment | null {
  const catalog: Record<
    string,
    { title: string; task: string; cases: [string, string][] }
  > = {
    "first-program": {
      title: "Two-line greeting",
      task: "Print Build on the first line and Logic on the second. Match capitalization exactly. This differs from the original Hello, world task.",
      cases: [["", "Build\nLogic"]],
    },
    variables: {
      title: "Swap and add",
      task: "Read two integers on separate lines. Store them in variables, then print their sum followed by their product, each on its own line.",
      cases: [
        ["3\n7\n", "10\n21"],
        ["-2\n5\n", "3\n-10"],
        ["0\n4\n", "4\n0"],
      ],
    },
    input: {
      title: "Triple, then add one",
      task: "Read one integer n. Print 3 * n + 1. This changes the original doubling task. Handle zero and negative inputs too.",
      cases: [
        ["4\n", "13"],
        ["0\n", "1"],
        ["-3\n", "-8"],
      ],
    },
    math: {
      title: "Quotient and remainder",
      task: "Read a nonnegative integer n and a positive divisor d on separate lines. Print the integer quotient n / d and the remainder n % d on separate lines.",
      cases: [
        ["23\n4\n", "5\n3"],
        ["0\n3\n", "0\n0"],
        ["12\n6\n", "2\n0"],
      ],
    },
    conditions: {
      title: "Three-way sign decision",
      task: "Read an integer. Print negative for n < 0, zero for n == 0, or positive for n > 0. Use lowercase, with no prompts. Unlike the original task, zero needs its own branch.",
      cases: [
        ["-7\n", "negative"],
        ["0\n", "zero"],
        ["19\n", "positive"],
      ],
    },
    loops: {
      title: "Sum the even numbers",
      task: "Read a nonnegative integer n. Use a loop to add every even integer from 0 through n (inclusive), then print the sum. This is a new task, not the original count from 1 to 5.",
      cases: [
        ["6\n", "12"],
        ["0\n", "0"],
        ["7\n", "12"],
        ["2\n", "2"],
      ],
    },
    functions: {
      title: "Cube through a function",
      task: "Read an integer n. Define a function cube(n) that returns n * n * n, call it, and print the result. This changes the original square task.",
      cases: [
        ["3\n", "27"],
        ["-2\n", "-8"],
        ["0\n", "0"],
      ],
    },
    recursion: {
      title: "Recursive sum",
      task: "Read a nonnegative integer n. Define sum_to(n) recursively: return 0 for n == 0, otherwise n + sum_to(n - 1). Print sum_to(n). This changes the original factorial task.",
      cases: [
        ["4\n", "10"],
        ["0\n", "0"],
        ["1\n", "1"],
        ["7\n", "28"],
      ],
    },
    "arrays-lists": {
      title: "Count values above a threshold",
      task: "Read count n, then n integers (one per line), then a threshold t. Store the values in an array/list and print how many are strictly greater than t. For n == 0, print 0.",
      cases: [
        ["4\n2\n8\n5\n9\n5\n", "2"],
        ["0\n3\n", "0"],
        ["3\n4\n4\n4\n4\n", "0"],
      ],
    },
    strings: {
      title: "Count lowercase vowels",
      task: "Read one line of lowercase letters (possibly empty). Count occurrences of a, e, i, o, u and print the count. This differs from the original string-length task.",
      cases: [
        ["logic\n", "2"],
        ["rhythm\n", "0"],
        ["\n", "0"],
        ["aeiou\n", "5"],
      ],
    },
  };
  if (diagnostic) {
    catalog["variables"] = {
      title: "Save, then change",
      task: "Read an integer n. Set saved = n, then increase n by 5. Print saved and then n on separate lines. Changing n must not change saved.",
      cases: [
        ["3\n", "3\n8"],
        ["-5\n", "-5\n0"],
        ["0\n", "0\n5"],
      ],
    };
    catalog["strings"] = {
      title: "Count spaces in a line",
      task: "Read a complete line, possibly empty. Print the number of literal space characters in it. Do not count the input newline. Preserve leading, trailing and repeated spaces.",
      cases: [
        ["a b\n", "1"],
        [" a  b \n", "4"],
        ["abc\n", "0"],
        ["\n", "0"],
      ],
    };
    catalog["arrays-lists"] = {
      title: "Read an indexed item",
      task: "Read a positive count n, then n integers (one per line), then a valid zero-based index k. Print the item at index k. The first item has index 0.",
      cases: [
        ["3\n10\n20\n30\n1\n", "20"],
        ["1\n-4\n0\n", "-4"],
        ["3\n7\n8\n9\n2\n", "9"],
      ],
    };
    catalog["recursion"] = {
      title: "Changed recursive base",
      task: "Read a nonnegative integer n. Define f(0)=2 and f(n)=n+f(n-1). Print f(n). This changes both the old factorial task and the probe base case; do not assume a base of 0 or 1.",
      cases: [
        ["0\n", "2"],
        ["1\n", "3"],
        ["4\n", "12"],
        ["7\n", "30"],
      ],
    };
  }
  const spec = catalog[topicId];
  if (!spec || !["c", "python"].includes(language.toLowerCase())) return null;
  return {
    title: spec.title,
    task: spec.task,
    version: diagnostic ? "diagnostic-v1" : "transfer-v1",
    tests: spec.cases.map(([stdin, expected], i) => ({
      name: `Transfer check ${i + 1}`,
      stdin,
      expected,
      unseen: true,
    })),
    createdAt: at,
    attempts: 0,
  };
}

/** Saves a prepared reassessment onto its locked misconception. */
export function attachReassessment(
  prev: StruggleState,
  misconceptionId: string,
  reassessment: Reassessment,
): StruggleState {
  return {
    ...prev,
    ingestedSessions: prev.ingestedSessions ?? [],
    misconceptions: prev.misconceptions.map((m) =>
      m.id === misconceptionId && m.status === "locked"
        ? { ...m, reassessment }
        : m,
    ),
  };
}

/**
 * Reassess → Conquer: records one graded targeted-reassessment Submit. The
 * pattern conquers only when every reassessment check passes AND the code
 * satisfies the required construct, at a time after the lock. A failed
 * reassessment is more recorded evidence on the same pattern.
 */
export function recordReassessmentAttempt(
  prev: StruggleState,
  input: {
    misconceptionId: string;
    graded: GradedResult[];
    constructOk: boolean;
    at?: number;
  },
): { state: StruggleState; outcome: RecordOutcome | null } {
  const at = input.at ?? Date.now();
  const target = prev.misconceptions.find(
    (m) => m.id === input.misconceptionId,
  );
  if (!target || target.status !== "locked" || (target.lockedAt ?? 0) >= at)
    return { state: prev, outcome: null };

  if (target.sourceSessionId && !target.transferTopicId)
    return { state: prev, outcome: null };
  const spec = target.reassessment;
  if (
    !spec ||
    !["transfer-v1", "diagnostic-v1"].includes(spec.version ?? "") ||
    spec.createdAt <= (target.lockedAt ?? 0) ||
    spec.createdAt > at
  )
    return { state: prev, outcome: null };
  const canonical = newReassessment(
    target.transferTopicId ?? target.topicId,
    supportedTransferLanguage(target.language) ?? target.language,
    spec.createdAt,
    spec.version === "diagnostic-v1",
  );
  if (
    spec.version === "diagnostic-v1" &&
    (!target.diagnosis?.confirmed ||
      !target.diagnosis.reviewed ||
      target.diagnosis.choice !== 0 ||
      target.diagnosis.probeId !==
        diagnosticProbe(
          target.transferTopicId ?? target.topicId,
          supportedTransferLanguage(target.language) ?? target.language,
        )?.id ||
      target.diagnosis.at <= (target.lockedAt ?? 0) ||
      target.diagnosis.at > spec.createdAt)
  )
    return { state: prev, outcome: null };
  if (
    !canonical ||
    JSON.stringify(spec.tests) !== JSON.stringify(canonical.tests)
  )
    return { state: prev, outcome: null };
  const total = input.graded.length;
  const norm = (v: string) => v.replace(/\r/g, "").trim();
  const matchesSpec =
    total === spec.tests.length &&
    spec.tests.every((t, i) => {
      const g = input.graded[i];
      return g && g.name === t.name && g.expected === t.expected;
    });
  if (!matchesSpec) return { state: prev, outcome: null };
  const failing = input.graded.filter(
    (g) => !g.passed || norm(g.actual) !== norm(g.expected),
  );
  const fullPass = total > 0 && failing.length === 0 && input.constructOk;
  const kind = failing.length ? classifyFailure(failing[0]!) : null;

  counter += 1;
  const attempt: PracticeAttempt = {
    id: `${target.topicId}:${target.language}:reassess:${at}:${counter}`,
    topicId: target.topicId,
    topicTitle: target.topicTitle,
    language: target.language,
    exerciseTitle: "Targeted reassessment",
    at,
    passed: input.constructOk ? total - failing.length : 0,
    total,
    fullPass,
    kind,
    failingTests: failing.map((g) => g.name),
    signature: kind ? target.signature : null,
    source: "reassessment",
  };

  const misconceptions = prev.misconceptions.map((m) => {
    if (m.id !== target.id) return m;
    const bumped: Misconception = {
      ...m,
      lastSeenAt: at,
      reassessment: m.reassessment
        ? { ...m.reassessment, attempts: m.reassessment.attempts + 1 }
        : m.reassessment,
    };
    if (fullPass) {
      return {
        ...bumped,
        status: "conquered" as const,
        conqueredAt: at,
        failuresToConquer: m.occurrences,
        timeToConquerMs: at - m.firstSeenAt,
        reassessed: true,
      };
    }
    return { ...bumped, occurrences: m.occurrences + 1 };
  });
  const updated = misconceptions.find((m) => m.id === target.id)!;

  return {
    state: {
      attempts: [attempt, ...prev.attempts].slice(0, MAX_ATTEMPTS),
      misconceptions,
      celebratedIds: prev.celebratedIds,
      ingestedSessions: prev.ingestedSessions ?? [],
    },
    outcome: {
      attempt,
      locked: null,
      conquered: fullPass && updated.status === "conquered" ? updated : null,
    },
  };
}

/**
 * Feeds one VS Code build session into the same engine, deduped by its
 * session signature. A completed session records progress but never automatically conquers a
 * pattern: completion alone does not prove a new relevant reassessment.
 */
export function recordBuildSessionOutcome(
  prev: StruggleState,
  input: {
    sessionKey: string;
    topicId: string;
    baseTopicId?: string | undefined;
    concept?: string | undefined;
    sessionId?: string | undefined;
    topicTitle: string;
    language: string;
    exerciseTitle: string;
    completed: boolean;
    failed: boolean;
    passed: number;
    total: number;
    checkpoints?:
      | { title: string; status: string; lastOutput?: string | undefined }[]
      | undefined;
    at?: number;
  },
): { state: StruggleState; outcome: RecordOutcome | null } {
  const ingested = prev.ingestedSessions ?? [];
  if (ingested.includes(input.sessionKey))
    return { state: prev, outcome: null };
  const at = input.at ?? Date.now();

  let graded: GradedResult[];
  if (
    input.checkpoints?.some(
      (c) => c.status === "passed" || c.status === "failed",
    )
  ) {
    graded = input.checkpoints
      .filter((c) => c.status === "passed" || c.status === "failed")
      .map((c) => ({
        name: c.title,
        hidden: true,
        passed: c.status === "passed",
        expected: "",
        actual: c.lastOutput ?? "",
        status: c.status === "passed" ? "Accepted" : "Wrong Answer",
        stderr: "",
      }));
  } else if (input.total > 0) {
    // Aggregate scores do not identify individual failing tests. Record one
    // explicitly aggregate signal, not invented per-test pass positions.
    graded = [
      {
        name: "aggregate challenge outcome (test identities unavailable)",
        hidden: true,
        passed: input.completed && input.passed === input.total,
        expected: "",
        actual: "",
        status: input.completed ? "Accepted" : "Wrong Answer",
        stderr: "",
      },
    ];
  } else {
    graded = [
      {
        name: "challenge completion",
        hidden: true,
        passed: input.completed,
        expected: "",
        actual: "",
        status: input.completed ? "Accepted" : "Wrong Answer",
        stderr: "",
      },
    ];
  }

  const { state: recorded, outcome } = recordPracticeAttempt(
    { ...prev, ingestedSessions: [] },
    {
      topicId: input.topicId,
      topicTitle: input.topicTitle,
      language: input.language,
      exerciseTitle: input.exerciseTitle,
      exerciseHint: "",
      graded,
      at,
      source: "vscode",
    },
  );

  const concept = supportedTransferConcept(input.concept ?? "");
  // Project/aggregate failures are not equivalent to a concept exercise. Only
  // narrowly named failing concept checkpoints get this finite transfer path.
  const exactFailure =
    concept &&
    input.checkpoints
      ?.filter((c) => c.status === "failed")
      .every((c) => supportedTransferConcept(c.title) === concept) &&
    input.checkpoints?.some((c) => c.status === "failed");
  const language = supportedTransferLanguage(input.language);
  const misconceptions = recorded.misconceptions.map((m) =>
    m.topicId === input.topicId &&
    m.language === input.language &&
    m.signature === outcome.attempt.signature &&
    !outcome.attempt.fullPass
      ? {
          ...m,
          sourceSessionId: input.sessionId ?? m.sourceSessionId,
          transferTopicId:
            concept && language && exactFailure ? concept : undefined,
        }
      : m,
  );
  const conquered = outcome.conquered;
  // Session completion does not prove a NEW, relevant reassessment. Keep
  // locks until explicit transfer-task evidence is available; never infer it
  // from a recovery suffix or a later completion alone.

  return {
    state: {
      ...recorded,
      misconceptions,
      ingestedSessions: [...ingested, input.sessionKey].slice(-200),
    },
    outcome: { ...outcome, conquered },
  };
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
        m.reassessed === true &&
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
    if (m.status === "conquered" && m.reassessed === true) row.conquered += 1;
    else if (m.status !== "conquered") row.activeMisconceptions += 1;
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
  /** Average elapsed wall-clock ms from first failure to conquering pass. */
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
        (m.failuresToConquer ?? 0) >= LOCK_THRESHOLD &&
        m.reassessed === true),
  );
  const conquered = prev.misconceptions.filter(
    (m) => m.status === "conquered" && m.reassessed === true,
  );
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

/**
 * Failure Replay: the honest before/after story of one conquered pattern.
 * Every clause quotes recorded data; elapsed figures are wall-clock time
 * between recorded submissions, never claimed as active learning time.
 */
export function failureReplay(m: Misconception): {
  before: string;
  cause: string;
  after: string;
} {
  let before = m.example
    ? `"${m.example.testName}" kept failing${m.example.actual ? ` - your recorded output was "${m.example.actual.slice(0, 80)}" against the goal "${m.example.expected.slice(0, 80)}"` : ""}.`
    : `${m.summary}.`;
  const n = m.failuresToConquer ?? m.occurrences;
  let cause = `Recorded failing in ${n} graded submission${n === 1 ? "" : "s"}, for this tracked pattern (${KIND_LABEL[m.kind]}). This groups observed results; it does not establish what caused the mistakes.`;
  const mins =
    typeof m.timeToConquerMs === "number"
      ? Math.max(1, Math.round(m.timeToConquerMs / 60000))
      : null;
  const took =
    mins === null
      ? ""
      : mins < 60
        ? ` Elapsed time from the first recorded failure: ${mins} min.`
        : ` Elapsed time from the first recorded failure: about ${Math.round(mins / 60)} h.`;
  let after = m.reassessed
    ? `You then passed this pattern's targeted reassessment - a changed task with new transfer checks.${took}`
    : `A later recorded attempt passed every check on ${m.topicTitle}.${took}`;
  const diagnosis = m.diagnosis;
  const probe = diagnosticProbe(
    m.transferTopicId ?? m.topicId,
    supportedTransferLanguage(m.language) ?? m.language,
  );
  if (diagnosis && probe && diagnosis.probeId === probe.id) {
    before += ` On the prediction probe, you chose "${probe.options[diagnosis.choice] ?? "unknown"}"; the trace produces "${probe.options[probe.correct]}".`;
    cause =
      diagnosis.confirmed && diagnosis.choice !== probe.correct
        ? `Your confirmed explanation: ${probe.hypothesis} This is your reported cause, supported by one prediction probe, not a verified account of every earlier error.`
        : `The prediction probe ${diagnosis.choice === probe.correct ? "was correct and did not support this misconception" : "showed a prediction mismatch, but you did not confirm it as the cause of your original failure"}. The original cause remains unresolved.`;
    if (diagnosis.confirmed && diagnosis.choice !== probe.correct)
      after += ` Mental model to use: ${probe.model}`;
  }
  return { before, cause, after };
}

export type DiagnosticEvidence = {
  probeId: string;
  choice: number;
  confirmed: boolean;
  reviewed?: boolean | undefined;
  at: number;
};
export type DiagnosticProbe = {
  id: string;
  question: string;
  options: string[];
  correct: number;
  hypothesis: string;
  model: string;
  transferFocus: string;
};

/** Narrow exact aliases only. A framework, title substring or stack never proves a concept. */
export function supportedTransferConcept(concept: string): string | null {
  const aliases: Record<string, string> = {
    "first-program": "first-program",
    "first program": "first-program",
    variables: "variables",
    input: "input",
    "input/output": "input",
    math: "math",
    arithmetic: "math",
    conditions: "conditions",
    conditionals: "conditions",
    loops: "loops",
    functions: "functions",
    arrays: "arrays-lists",
    "arrays-lists": "arrays-lists",
    "arrays/lists": "arrays-lists",
    strings: "strings",
    recursion: "recursion",
  };
  return aliases[concept.toLowerCase().trim()] ?? null;
}
export function supportedTransferLanguage(
  language: string,
): "c" | "python" | null {
  const value = language.toLowerCase().trim();
  return value === "c"
    ? "c"
    : value === "python" || value === "python3"
      ? "python"
      : null;
}

/** Predict before seeing the model. A wrong answer is evidence for a hypothesis, not mind-reading. */
export function diagnosticProbe(
  topic: string,
  language: string,
): DiagnosticProbe | null {
  const c = language === "c";
  const data: Record<string, Omit<DiagnosticProbe, "id">> = {
    "first-program": {
      question:
        'Predict the output of two print calls, one for "Build" and one for "Logic", each ending in a newline.',
      options: [
        "Build Logic (one line)",
        "Build then Logic (two lines)",
        "Not sure",
      ],
      correct: 1,
      hypothesis:
        "I treated separate newline-terminated output calls as one line.",
      model:
        "Each newline ends the current line. Output layout is part of the contract.",
      transferFocus: "Write a changed two-line greeting with exact layout.",
    },
    variables: {
      question: "Set a = 3, b = a, then a = 7. What is b?",
      options: ["7", "3", "Not sure"],
      correct: 1,
      hypothesis:
        "I expected a copied integer variable to track later changes to the source variable.",
      model:
        "An integer assignment copies the current value. Changing a later does not change b.",
      transferFocus: "Keep a saved value while changing the original variable.",
    },
    input: {
      question:
        "Input is the integer 4. A program reads n and prints 3*n+1. What does it print?",
      options: ["4441", "13", "Not sure"],
      correct: 1,
      hypothesis: "I treated numeric input as text when applying arithmetic.",
      model: "Convert input text to an integer before arithmetic. 3*4+1 is 13.",
      transferFocus:
        "Read and transform numeric input, including zero and negatives.",
    },
    math: {
      question: c
        ? "In C integer arithmetic, what are 7/2 and 7%2?"
        : "In Python, what are 7//2 and 7%2?",
      options: ["3.5 and 0", "3 and 1", "Not sure"],
      correct: 1,
      hypothesis: "I mixed up integer quotient, real division and remainder.",
      model:
        "For nonnegative integers, n = quotient*d + remainder, with remainder smaller than d.",
      transferFocus:
        "Compute both quotient and remainder, including exact divisibility.",
    },
    conditions: {
      question:
        "For n = 0, does the condition n > 0 select the positive branch?",
      options: ["Yes", "No", "Not sure"],
      correct: 1,
      hypothesis: "I included zero in a strictly-positive branch.",
      model:
        "Strictly positive means greater than zero. Zero needs its own case when the task distinguishes signs.",
      transferFocus:
        "Distinguish negative, zero and positive without collapsing the boundary.",
    },
    loops: {
      question: c
        ? 'Predict the last value printed by: for (int i=1; i<5; i++) printf("%d ", i);'
        : "Predict the last value printed by: for i in range(1, 5): print(i)",
      options: ["5", "4", "Not sure"],
      correct: 1,
      hypothesis: "I expected an exclusive upper bound to be included.",
      model:
        "The loop runs only while the value is below the exclusive stop. To include n, use <= n in C or range(..., n+1) in Python.",
      transferFocus:
        "Include an even upper endpoint in a sum, and handle an empty range.",
    },
    functions: {
      question:
        "A function returns 4 but never prints. Its return value is ignored. What output appears?",
      options: ["4", "No output", "Not sure"],
      correct: 1,
      hypothesis: "I treated returning a value as printing it.",
      model:
        "Return gives a value to the caller. Printing is a separate side effect.",
      transferFocus:
        "Return a computed value and explicitly print the result at the call site.",
    },
    "arrays-lists": {
      question:
        "An array/list contains [10, 20, 30]. What value is at index 1?",
      options: ["10", "20", "Not sure"],
      correct: 1,
      hypothesis: "I treated zero-based indexing as one-based indexing.",
      model:
        "Index 0 names the first item; index 1 names the second. The last valid index is length-1.",
      transferFocus:
        "Process a changed collection, including a single-item boundary.",
    },
    strings: {
      question:
        'Predict the length of the string "a b". Count only its characters, not quotes or an input newline.',
      options: ["2", "3", "Not sure"],
      correct: 1,
      hypothesis: "I ignored spaces when counting string characters.",
      model:
        "A space is a character. Input readers differ in whether they preserve spaces and trailing newlines.",
      transferFocus:
        "Handle character content rather than treating a string as a number or a single token.",
    },
    recursion: {
      question:
        "f(n) returns 1 at n=0; otherwise it returns n*f(n-1). What is f(0)?",
      options: ["0", "1", "Not sure"],
      correct: 1,
      hypothesis: "I replaced the recursion base case with the input value.",
      model:
        "The base case returns exactly the specified value and stops recursion. In this probe it is 1 at zero; a changed task can specify another base.",
      transferFocus:
        "Keep a valid base case while changing a recursive computation.",
    },
  };
  const probe = data[topic];
  return probe && (language === "c" || language === "python")
    ? { ...probe, id: `prediction-v1:${topic}:${language}` }
    : null;
}

export function recordDiagnosticPrediction(
  prev: StruggleState,
  misconceptionId: string,
  choice: number,
  confirmed: boolean,
  at = Date.now(),
  reviewed = true,
): StruggleState {
  const target = prev.misconceptions.find(
    (m) => m.id === misconceptionId && m.status === "locked",
  );
  if (
    !target ||
    target.diagnosis?.reviewed ||
    !Number.isFinite(at) ||
    at <= (target.lockedAt ?? 0)
  )
    return prev;
  const lang = supportedTransferLanguage(target.language);
  const probe = lang
    ? diagnosticProbe(target.transferTopicId ?? target.topicId, lang)
    : null;
  if (
    !probe ||
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice >= probe.options.length
  )
    return prev;
  return {
    ...prev,
    misconceptions: prev.misconceptions.map((m) =>
      m.id === target.id
        ? {
            ...m,
            diagnosis: {
              probeId: probe.id,
              choice: target.diagnosis?.choice ?? choice,
              confirmed:
                confirmed &&
                (target.diagnosis?.choice ?? choice) === 0 &&
                reviewed,
              reviewed,
              at: target.diagnosis?.at ?? at,
            },
          }
        : m,
    ),
  };
}

/** Only observed patterns and explicitly attributed learner hypotheses reach the mentor. */
export function diagnosticMentorContext(
  state: StruggleState,
  topicId?: string,
): string {
  const patterns = state.misconceptions
    .filter((m) => !topicId || (m.transferTopicId ?? m.topicId) === topicId)
    .slice(-5);
  return patterns
    .map((m) => {
      const probe = diagnosticProbe(
        m.transferTopicId ?? m.topicId,
        supportedTransferLanguage(m.language) ?? m.language,
      );
      const diagnosis = m.diagnosis;
      const attribution =
        diagnosis?.confirmed && probe
          ? `Learner-confirmed hypothesis (one prediction probe, not a verified root cause): ${probe.hypothesis} Model: ${probe.model}`
          : "Cause unresolved. Do not infer the learner's belief or thinking style from output grouping.";
      return `${m.topicTitle}: ${m.occurrences} recorded failures; ${m.status}. ${attribution}`;
    })
    .join("\n")
    .slice(0, 2000);
}
