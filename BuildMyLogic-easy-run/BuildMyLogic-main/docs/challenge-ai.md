# Challenge the AI: code-review practice

Added as a separate `/challenge-ai` route with a link from Learn. Existing practice, Struggle DNA, sign-in, mentor and camera flows are unchanged.

## What it does

Learners design an input that breaks a plausible wrong solution, predict the output required by the specification, compare the actual result with a deterministic reference rule, and identify the failed assumption. Three curated JavaScript rounds cover boundaries, negative initialization, and non-adjacent duplicates.

Fixed functions run in the browser, without model calls, arbitrary code evaluation, remote code execution, or learner-record writes. Displayed snippets are checked against their executable counterparts in automated tests. Page-session completion resets on reload. The page is practice, not a credential or an AI-use detector.

## Why this addition

The existing product already has diagnosis, hints, fresh-task reassessment and Failure Replay. A reverse-role test-design exercise adds a different learner action and a concise live demonstration: passing the sample is not the same as meeting the specification. It is not a claim that code-review practice is a new invention or guarantees competition success.

Current competitive context:
- CodeSignal Cosmo already advertises context-aware tutoring, personalized paths, non-answer-giving help and mastery checks: https://codesignal.com/cosmo/
- Harvard's CS50 has described question-based debugging and planned oral assessment: https://www.harvardmagazine.com/2023/08/ai-in-education

Learning rationale, not proof of this feature's effectiveness:
- Anthropic's 52-participant study assessed code reading, debugging and conceptual understanding separately from task completion: https://www.anthropic.com/research/AI-assistance-coding-skills
- An ICER study supports studying self-explanation alongside hints, within its own task and participant limits: https://dl.acm.org/doi/10.1145/3291279.3339420

Event fit:
- SCMS's 2026 guidelines include AI solutions for personalized learning. They do not publish weighted judging criteria: https://scmsgroup.org/sset/wp-content/uploads/2026/10/PPTHA-2026-Detailed_Guidelines.pdf
- The SCMS November 2025 newsletter names Smart Chair, AI irrigation, and animal-tracking prize projects. This supports focusing the demo on a concrete problem and visible mechanism, not a causal claim about winning: https://scmsgroup.org/sstm/wp-content/uploads/2026/04/SCMS-News-Letter-November-2025.pdf

## 60-second demo

1. Open Conditions. Show that age 20 passes the example.
2. Enter age 18 and predict 1.
3. Run the counterexample. The code returns 0 while the specification requires 1.
4. Choose the boundary explanation and check the reasoning.
5. Explain the product distinction: do not merely trust or repair generated code; learn to challenge it with evidence.

## Verification

- Candidate snippets checked against executed functions on all 121 valid ages and 399 short-list cases per list challenge.
- Invalid inputs and wrong predictions rejected; happy-path inputs do not count as counterexamples.
- Browser QA completes all rounds, verifies reload reset and checks 390px mobile overflow.
- Does not establish unaided work, durable knowledge, general mastery or employment readiness.
