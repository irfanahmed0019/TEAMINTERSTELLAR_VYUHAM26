import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initialCodingTask,
  codingTopicOptions,
  nextInitialCodingTask,
  acceptInitialCodingResult,
  suggestedCodingTopic,
  codingDiagnosticSummary,
} from "./initial-coding-diagnostic.ts";
import { STUDY_TOPICS } from "./topic-library.ts";
import { competencyView } from "./competency.ts";
const basics = JSON.parse(
  readFileSync(
    new URL("./initial-coding-basic-reference.json", import.meta.url),
    "utf8",
  ),
);
const refs = JSON.parse(
  readFileSync(
    new URL("./reassessment-reference.json", import.meta.url),
    "utf8",
  ),
);
for (const { id } of codingTopicOptions())
  for (const language of ["c", "python"])
    for (const level of ["basic", "transfer"]) {
      test(`initial diagnostic catalog real execution: ${id}/${language}/${level}`, () => {
        const task = initialCodingTask(`coding-v1:${id}:${level}`, language);
        assert.ok(task);
        assert.ok(task.tests.length && task.tests.length <= 10);
        const code =
          level === "transfer"
            ? refs[id][language]
            : (STUDY_TOPICS.find((t) => t.id === id).exercise[language]
                .solution ?? basics[id]?.[language]);
        assert.ok(
          code,
          `missing authored reference ${id}/${language}/${level}`,
        );
        const dir = mkdtempSync(join(tmpdir(), "bml-initial-"));
        try {
          const file = join(dir, language === "c" ? "main.c" : "main.py");
          writeFileSync(file, code);
          if (language === "c") {
            const result = spawnSync(
              "gcc",
              ["-std=c11", file, "-o", join(dir, "main")],
              { encoding: "utf8" },
            );
            assert.equal(result.status, 0, result.stderr);
          }
          for (const check of task.tests) {
            const result = spawnSync(
              language === "c" ? join(dir, "main") : "python3",
              language === "c" ? [] : [file],
              { encoding: "utf8", input: check.stdin, timeout: 3000 },
            );
            assert.equal(result.status, 0, result.stderr);
            assert.equal(
              result.stdout.trim(),
              check.expected.trim(),
              check.name,
            );
          }
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      });
    }
const initial = {
  version: 1,
  language: "python",
  topicId: "conditions",
  submissions: [],
};
function evidence(task, passed = task.tests.length) {
  return {
    id: "initial-coding:one",
    taskId: task.id,
    language: task.language,
    ownerId: "owner",
    topicId: task.topicId,
    skill: task.skill,
    passed,
    total: task.tests.length,
    at: 100,
    hintsUsed: 0,
    source: "server-graded initial coding tests",
  };
}
test("first task medium-estimated transfer, failure scaffolds and pass raises related concept", () => {
  const task = nextInitialCodingTask(initial);
  assert.equal(task.level, "transfer");
  assert.equal(task.topicId, "conditions");
  const failed = acceptInitialCodingResult(
    initial,
    task,
    evidence(task, 0),
    "owner",
  );
  assert.equal(nextInitialCodingTask(failed).level, "basic");
  assert.equal(nextInitialCodingTask(failed).topicId, "conditions");
  const pass = acceptInitialCodingResult(
    initial,
    task,
    evidence(task),
    "owner",
  );
  assert.equal(nextInitialCodingTask(pass).topicId, "loops");
  const second = nextInitialCodingTask(pass);
  const done = acceptInitialCodingResult(
    pass,
    second,
    { ...evidence(second), id: "initial-coding:two" },
    "owner",
  );
  assert.equal(nextInitialCodingTask(done), null);
  assert.match(codingDiagnosticSummary(done), /2\/2/);
});
test("unavailable and forged/wrong owner/stale task responses never create completed coding work", () => {
  const task = nextInitialCodingTask(initial);
  for (const bad of [
    { ...evidence(task), ownerId: "other" },
    { ...evidence(task), topicId: "loops" },
    { ...evidence(task), passed: 999 },
    { ...evidence(task), total: 0 },
    { ...evidence(task), source: "client" },
    { ...evidence(task), taskId: "coding-v1:conditions:basic" },
    { ...evidence(task), language: "c" },
    { ...evidence(task), skill: "Wrong skill" },
    { ...evidence(task), hintsUsed: -1 },
    { ...evidence(task), at: NaN },
  ])
    assert.equal(
      acceptInitialCodingResult(initial, task, bad, "owner"),
      initial,
    );
  assert.equal(
    acceptInitialCodingResult(
      initial,
      initialCodingTask("coding-v1:loops:transfer", "python"),
      evidence(task),
      "owner",
    ),
    initial,
  );
  assert.equal(
    initialCodingTask("coding-v1:loops:transfer", "javascript"),
    null,
  );
  assert.equal(initialCodingTask("arbitrary", "c"), null);
  assert.match(codingDiagnosticSummary(), /No initial practical/);
});
test("server result feeds central competency rather than claimed percentage", () => {
  const task = nextInitialCodingTask(initial);
  const e = evidence(task, 0);
  const view = competencyView({
    profile: {},
    plan: { skills: [{ name: task.skill, level: 99 }] },
    assessmentEvidence: [e],
    struggle: { attempts: [] },
  });
  const skill = view.find((v) => v.skill === task.skill);
  assert.ok(skill);
  assert.ok(skill.estimate < 99);
  assert.ok(
    skill.evidenceSources.includes(
      "server-graded initial coding tests (hints not recorded as used; independence unverified)",
    ),
  );
});
test("resume claims suggest matching topic but do not generate evidence", () => {
  assert.equal(
    suggestedCodingTopic({
      goal: "learn",
      goalDetail: "",
      projectIdea: "",
      experienceDetail: "",
      resumeSummary: "Used recursion in project",
      resumeText: "",
      followUps: [],
      technologies: [],
    }),
    "recursion",
  );
  assert.equal(initial.submissions.length, 0);
});

test("draft uses existing profile and clears only after an accepted coding result", () => {
  const task = nextInitialCodingTask(initial);
  const withDraft = {
    ...initial,
    draft: {
      taskId: task.id,
      language: task.language,
      code: "private code",
      hintUsed: true,
    },
  };
  assert.equal(
    acceptInitialCodingResult(
      withDraft,
      task,
      { ...evidence(task), ownerId: "other" },
      "owner",
    ),
    withDraft,
  );
  const accepted = acceptInitialCodingResult(
    withDraft,
    task,
    evidence(task),
    "owner",
  );
  assert.equal(accepted.draft, undefined);
  assert.equal(accepted.submissions.length, 1);
  assert.equal(
    acceptInitialCodingResult(accepted, task, evidence(task), "owner"),
    accepted,
  );
  for (const t of codingTopicOptions())
    for (const language of ["c", "python"])
      for (const level of ["basic", "transfer"])
        assert.ok(
          initialCodingTask(`coding-v1:${t.id}:${level}`, language).tests.every(
            (t) => t.hidden === false,
          ),
        );
});
