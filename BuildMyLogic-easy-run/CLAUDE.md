# BuildMyLogic — Project Brief

The VS Code extension observes how the student develops. The backend understands their performance. Jev decides what should happen next. Sarvam teaches them. The website adapts their learning journey.

## 1. VS Code extension responsibilities
1. Project intelligence — detect connected project, languages/frameworks, structure, dependencies, current milestone.
2. Code monitoring — file changes, implementation evidence, recurring patterns, progress.
3. Error monitoring — compiler diagnostics, build failures, runtime errors, repeated mistakes.
4. Test monitoring — test results, failed cases, expected vs actual, requirement verification.
5. AI assistance — explain code/errors, hints, exercises, misconception help.
6. Learning synchronization — send evidence to backend, receive tasks, show recommendations, sync progress with website.

## 2. Backend responsibilities
Central intelligence/coordination layer: auth & session mgmt, receiving VS Code events, processing/storing evidence, identifying skill gaps, coordinating Jev/Sarvam, evaluating assessments, updating competencies, selecting interventions, recommending next project, syncing website & extension.

Extend the existing TanStack Start backend / session API routes rather than building a separate backend.

## 3. Three logical agents
- **Code Intelligence Agent**: understands what's being built from code evidence, file changes, project structure, compiler errors, test results → development evidence, error patterns, completion evidence, learning difficulties. (VS Code API, TypeScript, static analysis, test integration.)
- **Learning and Assessment Agent**: Sarvam AI for explanations/teaching/exercises/debugging guidance/recommendations; deterministic assessment for test verification, compilation results, expected-vs-actual.
- **Adaptive Decision Agent**: Jev chooses next exercise, remediation need, difficulty, evaluates outcomes.

## 5. Dynamic project recommendation
Recommend next projects from demonstrated weaknesses (per-skill competency levels). Adaptive Decision Agent picks the priority; website explains *why* a project was recommended; student must approve the transition, not have it silently swapped.

## 6. Personalized YouTube recommendations
For identified weaknesses: generate focused search query → retrieve real videos via verified search integration → show real title/channel/URL → link to milestone → give practical exercise → reassess. Never fabricate links or treat watching as mastery proof.

## 7. AF-05 mapping
| AF-05 requirement | Implementation |
|---|---|
| Track performance | VS Code evidence + assessments |
| Identify misconceptions | Learning and Assessment Agent |
| Adapt explanations | Sarvam AI |
| Adapt exercises | Jev + Sarvam |
| Schedule revision | Adaptive Learning Engine |
| Measure mastery | Deterministic assessment |
| Evaluate retention | Delayed reassessment |

Jev's RLCD training does not by itself mean reinforcement learning is implemented — the app must measure intervention outcomes and evaluate its own adaptive policy.

## 8. Responsibility breakdown
| Component | Responsibility |
|---|---|
| Website | Student interaction & dashboard |
| VS Code Extension | Real development evidence |
| Backend | Communication & orchestration |
| Code Intelligence Agent | Project understanding |
| Sarvam AI | Teaching & explanations |
| Jev | Structured decisions |
| Assessment Engine | Actual performance verification |
| Adaptive Learning Engine | Changes priorities/projects |
| Supabase | Persistent student & learning data |

BuildMyLogic understands what a student can build, identifies what they struggle with, teaches the missing concepts, recommends the next appropriate project, and measures whether they genuinely improved.

