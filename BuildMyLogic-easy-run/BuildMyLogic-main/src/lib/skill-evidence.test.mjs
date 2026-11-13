import test from "node:test";
import assert from "node:assert/strict";

// loop-store reads/writes window.localStorage; provide a minimal shim before import.
const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  },
};

// loop-store.ts imports "./loop-types" extensionless (bundler-style), which
// node --experimental-strip-types cannot resolve. Materialize an identical
// copy with the extension resolved and test that, so the real source is what
// runs, byte for byte except the import specifier.
import { readFileSync, writeFileSync, rmSync } from "node:fs";
const source = readFileSync(new URL("./loop-store.ts", import.meta.url), "utf8");
const patched = source
  .replace('from "./loop-types"', 'from "./loop-types.ts"')
  .replace('from "./struggle-engine"', 'from "./struggle-engine.ts"');
if (patched === source) throw new Error("loop-store import shape changed; update the test harness");
const tmpUrl = new URL("./loop-store.testable.tmp.ts", import.meta.url);
writeFileSync(tmpUrl, patched);
process.on("exit", () => rmSync(tmpUrl, { force: true }));

const { getLoopState, setLoopState, applyBuildSessionEvidence, normalizeLoopState } = await import("./loop-store.testable.tmp.ts");

const plan = {
  projectTitle: "Python Web Scraper",
  projectPitch: "Build a real scraper.",
  quote: "",
  headline: "",
  skills: [
    { name: "Python Basics", level: 0, note: "" },
    { name: "Data Handling", level: 0, note: "" },
  ],
  missions: [
    { id: "m1", title: "Python Setup & Syntax", description: "", difficulty: 0, skills: ["Python Basics"], deliverable: "", prerequisites: [], next_mission: "m2", steps: [{ title: "Install", detail: "" }] },
    { id: "m2", title: "Files & Data", description: "", difficulty: 1, skills: ["Data Handling"], deliverable: "", prerequisites: ["m1"], next_mission: "", steps: [{ title: "CSV", detail: "" }] },
  ],
  progress: { insights: [] },
};

function session(overrides) {
  return {
    session_id: "s1",
    challenge_id: "m1",
    title: "Python Setup & Syntax",
    language: "python",
    concept: "basics",
    status: "completed",
    attempts: 2,
    hints_used: 0,
    test_score: { passed: 5, total: 5 },
    ...overrides,
  };
}

// Mirrors the classification the Progress panel applies to skillMemory:
// assessed only with evidence, >= 40 is Stronger, below is Needs practice.
function classify(state, planSkillName) {
  const memory = state.skillMemory ?? {};
  const item = memory[planSkillName] ?? memory[planSkillName.toLowerCase().trim()];
  if (!item || (item.evidence?.length ?? 0) === 0) return "unassessed";
  return item.level >= 40 ? "strong" : "weak";
}

test("a passing VS Code challenge writes code_test evidence keyed by lowercased skill name", () => {
  setLoopState(() => ({ ...getLoopState(), plan, missionProgress: { m1: { status: "active", completedSteps: [] } } }));
  applyBuildSessionEvidence(session({}));
  const state = getLoopState();
  const item = state.skillMemory["python basics"];
  assert.ok(item, "evidence must be stored under the lowercased skill key");
  assert.equal(item.level, 12, "a pass adds +12");
  assert.equal(item.evidence.length, 1);
  assert.equal(item.evidence[0].source, "code_test");
  assert.match(item.evidence[0].description, /Passed 5\/5 tests in Python Setup & Syntax/);
  assert.ok(item.lastPracticedAt > 0);
});

test("re-applying the same build session is deduped by signature", () => {
  applyBuildSessionEvidence(session({}));
  const item = getLoopState().skillMemory["python basics"];
  assert.equal(item.evidence.length, 1, "duplicate session must not add evidence");
  assert.equal(item.level, 12, "duplicate session must not add level");
});

test("a failed challenge records assessed-but-weak evidence", () => {
  applyBuildSessionEvidence(session({ session_id: "s2", status: "failed", attempts: 3, test_score: { passed: 1, total: 5 } }));
  const item = getLoopState().skillMemory["python basics"];
  assert.equal(item.evidence.length, 2);
  assert.equal(item.level, 14, "a failure adds +2 (assessed but weak)");
  assert.match(item.evidence[0].description, /Failed Python Setup & Syntax \(1\/5 tests passing\)/);
  assert.equal(classify(getLoopState(), "Python Basics"), "weak", "low evidence level lands in Needs practice");
});

test("a struggling session (potential_struggle) also records weak evidence", () => {
  applyBuildSessionEvidence(session({ session_id: "s3", status: "active", potential_struggle: true, test_score: { passed: 2, total: 5 } }));
  const item = getLoopState().skillMemory["python basics"];
  assert.equal(item.evidence.length, 3);
  assert.equal(item.level, 16);
  assert.match(item.evidence[0].description, /Struggled on Python Setup & Syntax \(2\/5 tests passing\)/);
});

test("repeated passes move a skill from Needs practice to Stronger; untouched skills stay unassessed", () => {
  for (const id of ["s4", "s5", "s6"]) applyBuildSessionEvidence(session({ session_id: id, attempts: 1 }));
  const state = getLoopState();
  assert.equal(state.skillMemory["python basics"].level, 52);
  assert.equal(classify(state, "Python Basics"), "strong", ">= 40 with evidence shows under Stronger areas");
  assert.equal(classify(state, "Data Handling"), "unassessed", "skills without evidence stay Not assessed yet");
});

test("plan skill levels moved by build evidence never create assessment labels on their own", () => {
  const state = getLoopState();
  const planSkill = state.plan.skills.find((s) => s.name === "Data Handling");
  assert.equal(classify(state, planSkill.name), "unassessed", "plan levels alone never count as assessed");
});

test("VS Code sessions also feed the Struggle Engine, deduped by session signature", () => {
  const before = (getLoopState().struggle?.attempts ?? []).length;
  applyBuildSessionEvidence(session({ session_id: "s7", status: "failed", attempts: 4, test_score: { passed: 1, total: 5 } }));
  const mid = getLoopState().struggle;
  assert.equal(mid.attempts.length, before + 1, "failed session records one engine attempt");
  assert.equal(mid.attempts[0].source, "vscode");
  applyBuildSessionEvidence(session({ session_id: "s7", status: "failed", attempts: 4, test_score: { passed: 1, total: 5 } }));
  assert.equal(
    getLoopState().struggle.attempts.length,
    before + 1,
    "identical session signature must not double-record struggle evidence",
  );
});

test("struggle state survives the cloud save/load serialization round trip", () => {
  // saveLearnerStateToSupabase persists state_json as one JSON blob and
  // loadLearnerStateFromSupabase restores it through normalizeLoopState;
  // simulate exactly that boundary.
  const current = getLoopState();
  assert.ok((current.struggle?.attempts ?? []).length > 0, "fixture has struggle data");
  const wire = JSON.parse(JSON.stringify(current));
  const restored = normalizeLoopState(wire);
  assert.equal(
    JSON.stringify(restored.struggle),
    JSON.stringify(current.struggle),
    "struggle state must survive cloud sync intact",
  );
  assert.ok(Array.isArray(restored.struggle.ingestedSessions), "ingestedSessions always present after restore");
});
