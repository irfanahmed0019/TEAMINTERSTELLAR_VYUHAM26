import test from "node:test";
import assert from "node:assert/strict";
import { buildAiContext } from "./context-builder.ts";
const input = {
  profile: { name: "A", goal: "g", experience: "beginner" },
  mission: { title: "M", stack: "C", difficulty: 1, description: "d" },
  learningState: {
    concept: "loops",
    stepId: "s1",
    status: "active",
    attempts: 1,
    lastQuestion: "q",
    lastAnswer: "a",
    understood: false,
    hintsUsed: 0,
    demonstratedSkills: [],
  },
  skillMemory: {
    loops: {
      level: 98,
      evidence: [
        {
          description: "Struggled on Loops practice (1/3 tests passing).",
          at: 1,
          weight: 2,
          source: "code_test",
        },
      ],
    },
  },
  recentHistory: [],
};
test("skillMemory activity counts are never shown to the model as competency percentages", () => {
  const { userPrompt } = buildAiContext(input, "sys");
  assert.ok(!userPrompt.includes("98%"));
  assert.ok(!/AUTHORITATIVE/.test(userPrompt));
  assert.match(userPrompt, /not competency scores/);
  assert.match(userPrompt, /Struggled on Loops practice/);
});
test("empty skill memory falls back to demonstrated skills then to none", () => {
  const withDemo = buildAiContext(
    {
      ...input,
      skillMemory: {},
      learningState: { ...input.learningState, demonstratedSkills: ["arrays"] },
    },
    "sys",
  );
  assert.match(withDemo.userPrompt, /arrays/);
  const none = buildAiContext({ ...input, skillMemory: {} }, "sys");
  assert.match(none.userPrompt, /No practice events recorded yet/);
});
