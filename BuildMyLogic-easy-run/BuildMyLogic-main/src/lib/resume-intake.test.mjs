import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeResumeAnalysis,
  validateResumeFile,
} from "./resume-intake.ts";
test("resume claims are bounded, unverified, never promoted to competency", () => {
  const r = normalizeResumeAnalysis({
    summary: "Claims Python experience",
    technologies: [{ name: "Python", level: "expert" }],
    languages: ["Python"],
    projects: [
      { name: "Shop", complexity: "not stated", technologies: ["Python"] },
    ],
    verified: true,
    score: 100,
  });
  assert.equal(r.technologies[0].level, "beginner");
  assert.equal(r.claims.provenance, "resume_claims_unverified");
  assert.equal(r.score, undefined);
  assert.equal(r.verified, undefined);
  assert.equal(r.claims.projects[0].name, "Shop");
});
test("invalid/empty analyzer output fails visibly", () => {
  for (const r of [null, {}, "text"])
    assert.throws(() => normalizeResumeAnalysis(r));
});
test("resume file type and size validated before parsing", () => {
  validateResumeFile({ name: "cv.PDF", size: 100 });
  assert.throws(() => validateResumeFile({ name: "cv.exe", size: 100 }));
  assert.throws(() => validateResumeFile({ name: "cv.pdf", size: 6000000 }));
});

test("server-normalized resume claims survive client round-trip", () => {
  const raw = {
    summary: "Sample background",
    languages: ["Python"],
    frameworks: ["Flask"],
    tools: ["Git"],
    experience: "Two years claimed",
    competencyClaims: ["Intermediate Python"],
    projects: [
      { name: "Inventory", complexity: "small", technologies: ["Python"] },
    ],
  };
  const server = normalizeResumeAnalysis(raw);
  const client = normalizeResumeAnalysis(JSON.parse(JSON.stringify(server)));
  assert.deepEqual(client, server);
});
