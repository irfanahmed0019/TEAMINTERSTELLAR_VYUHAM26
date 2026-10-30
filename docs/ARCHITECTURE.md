# Intended Architecture

## Status and scope

No application architecture, stack, or implementation exists in the repository today. This document defines conceptual responsibilities and integration boundaries for the hackathon MVP; it does not prescribe a framework, database, API style, or model provider. Those choices remain open until the team selects the MVP domain and interface.

The working MVP domain is introductory algebraic sign rules. Its scope and stack-neutral shared contracts are defined in [MVP_SCOPE.md](MVP_SCOPE.md).

## Components

| Component | Responsibility | Current status |
| --- | --- | --- |
| Learner profile and knowledge state | Represent concept-level evidence, progress, optional confidence, and uncertainty. | Proposed |
| Assessment engine | Present tagged baseline, practice, post, delayed, and transfer items; capture attempts. | Proposed |
| Misconception detector | Map response patterns to plausible misconceptions with supporting evidence and confidence. | Proposed |
| Adaptive intervention selector | Choose the next explanation, exercise, check, or review from evidence and available content. | Proposed |
| Explanation and exercise generation | Supply correct, accessible content tailored to an intervention intent. | Proposed |
| Agent orchestration | Run the learning loop and record input, action, outcome, and rationale. | Proposed |
| Revision scheduler | Create and manage future review/check events from knowledge evidence. | Proposed |
| Progress and evaluation analytics | Separate immediate performance, retention, transfer, and optional calibration metrics. | Proposed |

## Data flow

```text
assessment or learner interaction
            ↓
attempt event (item, concept tags, response, outcome, optional confidence)
            ↓
learner knowledge state + possible misconception evidence
            ↓
orchestrator / intervention selector
            ↓
explanation, exercise, check, or scheduled revision
            ↓
new learner event → updated state, schedule, and evaluation analytics
```

Every intervention decision should retain a compact audit record: evidence considered, selected action, stated rationale, outcome, and uncertainty. This makes the demo inspectable and supports later evaluation.

## Suggested minimal contracts

Before parallel implementation, agree on a minimal representation for:

- `Concept`: stable identifier, label, and prerequisite relationships if used.
- `AssessmentItem`: identifier, concept tags, difficulty intent, response format, and version.
- `Attempt`: learner/session reference, item, response outcome, timestamp, hints, and optional confidence.
- `KnowledgeEvidence`: concept, evidence source, estimated state or score, and uncertainty.
- `MisconceptionHypothesis`: concept, label, evidence references, and confidence.
- `InterventionDecision`: input evidence, selected action/content, rationale, timestamp, and outcome link.
- `RevisionEvent`: concept, due time or delay, reason, status, and delayed result.

Field names, storage, and transport are deliberately open. Avoid committing multiple workstreams to a complex shared schema before the MVP proves its needs.

## Open decisions for the team

- Which learning domain and concept set will make the strongest focused MVP?
- Which client/server or local-only stack best matches team skills and demo constraints?
- What learner data is necessary, where will it live, and how will consent/deletion be handled?
- Will explanations be authored, model-assisted, or both, and what review/fallback is required?
- What delay is realistic for the retention demonstration, and how will the fixed baseline be delivered?
