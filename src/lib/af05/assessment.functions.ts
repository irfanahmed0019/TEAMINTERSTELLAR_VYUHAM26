/**
 * AF-05 agent server functions.
 *
 * Assessment Agent (kernel section 5C): evaluates submissions against real
 * execution evidence and rubrics, returns a validated structured contract.
 * Learning Agent (kernel section 5B): produces targeted explanations and
 * exercises for identified misconceptions.
 *
 * Both run through the single configured AI provider (Sarvam), require a
 * signed-in student, and every response is validated before the client is
 * allowed to persist anything.
 */
import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sarvamJson } from "../sarvam.server";
import type { AssessmentAgentResult } from "./types";

const authenticatedAi = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getAuthSessionForApi } = await import("../auth");
    const auth = await getAuthSessionForApi();
    if (!auth?.idToken) throw new Error("Sign in to use BuildMyLogic AI.");
    return next({ headers: { Authorization: `Bearer ${auth.idToken}` } });
  })
  .server(async ({ next }) => {
    const { authenticatedUserId } = await import("../request-auth.server");
    const userId = await authenticatedUserId(getRequest());
    if (!userId) throw new Error("Sign in to use BuildMyLogic AI.");
    return next({ context: { authenticatedUserId: userId } });
  });

function key(): string {
  const value = process.env["SARVAM_API_KEY"]?.trim();
  if (!value) {
    throw new Error(
      "Sarvam AI is not configured. Add a valid SARVAM_API_KEY to the server environment and redeploy.",
    );
  }
  return value;
}

const ACTIONS = [
  "advance",
  "targeted_practice",
  "revision",
  "reassess",
] as const;
type Action = (typeof ACTIONS)[number];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, 6);
}

/** Validate and normalise the Assessment Agent contract. Throws on malformed payloads. */
function validateAssessmentResult(raw: unknown): AssessmentAgentResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const score = Number(obj["score"]);
  const feedbackRaw = obj["feedback"];
  const feedback = typeof feedbackRaw === "string" ? feedbackRaw.trim() : "";
  if (!Number.isFinite(score) || !feedback) {
    throw new Error(
      "The assessment agent returned an unreadable result. Please try again.",
    );
  }
  const actionRaw = obj["recommended_action"];
  const action = ACTIONS.includes(actionRaw as Action)
    ? (actionRaw as Action)
    : "targeted_practice";
  const misRaw = obj["misconception"] as Record<string, unknown> | undefined;
  const misId = misRaw?.["id"];
  const misLabel = misRaw?.["label"];
  const misSev = misRaw?.["severity"];
  const misconception =
    typeof misId === "string" && typeof misLabel === "string"
      ? {
          id: misId.slice(0, 60),
          label: misLabel.slice(0, 140),
          severity: (["low", "medium", "high"].includes(misSev as string)
            ? misSev
            : "medium") as "low" | "medium" | "high",
        }
      : undefined;
  return {
    score: Math.max(0, Math.min(3, Math.round(score))),
    feedback: feedback.slice(0, 1200),
    strengths: asStringArray(obj["strengths"]),
    improvements: asStringArray(obj["improvements"]),
    misconception,
    recommended_action: action,
  };
}

const ASSESSOR_SYSTEM = `You are the Assessment Agent inside BuildMyLogic, an adaptive learning platform.
Evaluate student work fairly and specifically.
Rules:
- Score 0-3: 0 = no understanding shown, 1 = partial with serious gaps, 2 = mostly correct with minor gaps, 3 = correct and clear.
- Base judgments only on the provided work and test evidence. Never claim code works when tests failed.
- If a specific misconception is visible, name it precisely; otherwise omit the misconception field.
- recommended_action: "advance" (score 3, no misconception), "targeted_practice" (misconception found), "revision" (shallow understanding), "reassess" (score 0).
Return JSON: { "score": number, "feedback": string, "strengths": string[], "improvements": string[], "misconception"?: { "id": string, "label": string, "severity": "low"|"medium"|"high" }, "recommended_action": string }`;

export const af05AssessExplanation = createServerFn({ method: "POST" })
  .middleware([authenticatedAi])
  .inputValidator(
    (input: {
      skill: string;
      concept: string;
      question: string;
      answer: string;
    }) => {
      if (!input?.question || typeof input.answer !== "string") {
        throw new Error("Missing explanation input.");
      }
      return {
        skill: String(input.skill ?? "").slice(0, 40),
        concept: String(input.concept ?? "").slice(0, 60),
        question: String(input.question).slice(0, 1000),
        answer: input.answer.slice(0, 3000),
      };
    },
  )
  .handler(async ({ data }) => {
    const raw = await sarvamJson<unknown>(
      key(),
      ASSESSOR_SYSTEM,
      `Skill: ${data.skill}\nConcept: ${data.concept}\nQuestion asked: ${data.question}\nStudent's explanation:\n${data.answer}`,
      900,
    );
    return validateAssessmentResult(raw);
  });

export const af05AssessSubmission = createServerFn({ method: "POST" })
  .middleware([authenticatedAi])
  .inputValidator(
    (input: {
      skill: string;
      concept: string;
      instructions: string;
      code: string;
      testsPassed: number;
      testsTotal: number;
      failures?: { expected: unknown; received: unknown }[];
      attempts: number;
      hintsUsed: number;
    }) => {
      if (!input?.code || !Number.isFinite(input.testsPassed)) {
        throw new Error("Missing submission input.");
      }
      return {
        skill: String(input.skill ?? "").slice(0, 40),
        concept: String(input.concept ?? "").slice(0, 60),
        instructions: String(input.instructions ?? "").slice(0, 1000),
        code: String(input.code).slice(0, 8000),
        testsPassed: Math.max(0, Math.floor(Number(input.testsPassed))),
        testsTotal: Math.max(0, Math.floor(Number(input.testsTotal))),
        failures: Array.isArray(input.failures)
          ? input.failures.slice(0, 3)
          : [],
        attempts: Math.max(1, Math.floor(Number(input.attempts) || 1)),
        hintsUsed: Math.max(0, Math.floor(Number(input.hintsUsed) || 0)),
      };
    },
  )
  .handler(async ({ data }) => {
    const raw = await sarvamJson<unknown>(
      key(),
      `${ASSESSOR_SYSTEM}
- The deterministic test results below are ground truth from real execution. If all tests passed, the solution is functionally correct; assess approach and quality. If tests failed, the code does NOT work; diagnose the likely misconception from the failures.`,
      `Skill: ${data.skill}
Concept: ${data.concept}
Task: ${data.instructions}
Execution evidence: ${data.testsPassed}/${data.testsTotal} tests passed. Attempts: ${data.attempts}. Hints used: ${data.hintsUsed}.
Failed cases (expected vs received): ${JSON.stringify(data.failures)}
Student code:
${data.code}`,
      1000,
    );
    return validateAssessmentResult(raw);
  });

const LEARNING_SYSTEM = `You are the Learning Agent inside BuildMyLogic.
A student shows a specific misconception. Respond with:
- "explanation": teach the underlying concept at the student's level in 3-6 short sentences. Concrete, friendly, no jargon without explanation.
- "exercise": one small practice question (multiple choice with 3-4 options, exactly one correct) that tests THIS concept, not the same question they already failed.
- "hint": a single nudge that helps without giving the exercise answer away.
Never reveal solutions to the student's original task. Return JSON: { "explanation": string, "exercise": { "prompt": string, "options": [{ "id": "a", "text": string, "correct": boolean }] }, "hint": string }`;

export type LearningAgentResult = {
  explanation: string;
  exercise: {
    prompt: string;
    options: { id: string; text: string; correct: boolean }[];
  };
  hint: string;
};

export const af05LearningAgent = createServerFn({ method: "POST" })
  .middleware([authenticatedAi])
  .inputValidator(
    (input: {
      skill: string;
      concept: string;
      misconception: string;
      level: string;
      recentError?: string;
    }) => {
      if (!input?.misconception)
        throw new Error("Missing misconception input.");
      return {
        skill: String(input.skill ?? "").slice(0, 40),
        concept: String(input.concept ?? "").slice(0, 60),
        misconception: String(input.misconception).slice(0, 200),
        level: String(input.level ?? "beginner").slice(0, 20),
        recentError: String(input.recentError ?? "").slice(0, 500),
      };
    },
  )
  .handler(async ({ data }): Promise<LearningAgentResult> => {
    const raw = (await sarvamJson<unknown>(
      key(),
      LEARNING_SYSTEM,
      `Skill: ${data.skill}
Concept: ${data.concept}
Observed misconception: ${data.misconception}
Student level: ${data.level}
Recent error context: ${data.recentError || "none"}`,
      1100,
    )) as Record<string, unknown>;

    const explanationRaw = raw["explanation"];
    const explanation =
      typeof explanationRaw === "string" ? explanationRaw.trim() : "";
    const hintRaw = raw["hint"];
    const hint = typeof hintRaw === "string" ? hintRaw.trim() : "";
    const ex = raw["exercise"] as Record<string, unknown> | undefined;
    const optionsRaw = Array.isArray(ex?.["options"])
      ? (ex["options"] as unknown[])
      : [];
    const options = optionsRaw
      .map((o: unknown, i: number) => {
        const opt = o as Record<string, unknown>;
        const optId = opt["id"];
        const optText = opt["text"];
        return {
          id: typeof optId === "string" ? optId : String.fromCharCode(97 + i),
          text: typeof optText === "string" ? optText : "",
          correct: opt["correct"] === true,
        };
      })
      .filter((o) => o.text.trim().length > 0)
      .slice(0, 4);

    if (
      !explanation ||
      !hint ||
      typeof ex?.["prompt"] !== "string" ||
      options.length < 3 ||
      options.filter((o) => o.correct).length !== 1
    ) {
      throw new Error(
        "The learning agent returned an unreadable exercise. Please try again.",
      );
    }

    return {
      explanation: explanation.slice(0, 1500),
      exercise: { prompt: (ex["prompt"] as string).slice(0, 600), options },
      hint: hint.slice(0, 400),
    };
  });
