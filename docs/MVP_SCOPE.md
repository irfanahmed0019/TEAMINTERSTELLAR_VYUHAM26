# MVP Scope and Shared Contracts

## Decision

For the hackathon MVP, focus on **introductory algebraic sign rules**: evaluating and simplifying expressions with positive and negative numbers. This is a deliberately narrow domain with short, objectively scored items and recognizable error patterns. It supports a clear adaptive-versus-fixed demonstration without claiming broad curriculum coverage.

This is a team working decision, not evidence that any component has been implemented. Revisit it if the team identifies a domain that better fits its available content and demo constraints.

## Learner flow

1. Present a small baseline set tagged by concept.
2. Record each response, correctness, and optional confidence.
3. Identify a knowledge gap or a plausible sign-rule misconception.
4. Choose either a targeted explanation, focused practice, or a check item.
5. Record the intervention decision and outcome.
6. Schedule a delayed equivalent check and compare it with the fixed-sequence path.

## MVP concepts

Use stable identifiers rather than display text in data and code:

| Concept ID | Learner-facing label | MVP intent |
| --- | --- | --- |
| `integer-order` | Ordering positive and negative integers | Establish prerequisite understanding. |
| `addition-signs` | Adding signed integers | Identify same-sign and opposite-sign errors. |
| `subtraction-signs` | Subtracting signed integers | Identify confusion between subtraction and adding a negative. |
| `multiplication-signs` | Multiplying signed integers | Identify sign-product rule errors. |

## Minimal event contract

The names below are a shared logical contract, not a required database schema or API. Start with these fields and add fields only when a concrete MVP need requires them.

### Assessment item

```text
id, version, conceptIds, phase, prompt, responseType, expectedAnswer, difficulty
```

- `phase` is one of `baseline`, `practice`, `post`, `delayed`, or `transfer`.
- Equivalent items should share concept coverage and intended difficulty but not reuse the same prompt.

### Attempt

```text
id, sessionId, itemId, submittedAnswer, isCorrect, createdAt, confidence?, hintsUsed?
```

`confidence` and `hintsUsed` are optional. Do not infer either when it was not collected.

### Knowledge evidence

```text
id, sessionId, conceptId, attemptIds, estimatedState, uncertainty, createdAt
```

For the MVP, `estimatedState` may be a transparent label such as `needs-support`, `emerging`, or `demonstrated`; it does not need to imply a statistically validated learner model.

### Misconception hypothesis

```text
id, sessionId, conceptId, label, evidenceAttemptIds, confidence, status
```

`status` should distinguish `possible` from `supported`. A hypothesis is not a learner diagnosis.

Suggested initial labels:

- `treats-negative-as-always-smaller`
- `drops-negative-during-addition`
- `does-not-rewrite-subtraction-as-addition`
- `uses-same-sign-rule-for-multiplication`

### Intervention decision and outcome

```text
id, sessionId, inputEvidenceIds, actionType, contentId, rationale, createdAt, outcomeAttemptId?
```

- `actionType` is one of `explain`, `practice`, `check`, or `schedule-review`.
- `rationale` must be learner-safe, concise, and traceable to the input evidence.

### Revision event

```text
id, sessionId, conceptId, dueAt, reason, status, completedAttemptId?
```

`status` is one of `scheduled`, `completed`, or `missed`.

## Integration rules

- Use opaque session identifiers; do not put names, email addresses, or other direct identifiers into event records.
- Preserve item and content versions so assessment comparisons remain interpretable.
- Treat unknown values as unknown; do not replace missing confidence or outcome data with assumptions.
- All consumers of these contracts should tolerate optional fields and newly added fields.
- Coordinate any breaking contract change in the pull request and update [ARCHITECTURE.md](ARCHITECTURE.md) and this document.

## Acceptance criteria for this decision

- A contributor can author a baseline item using the concept identifiers and item contract.
- A frontend can emit an attempt without knowing the implementation of diagnosis or scheduling.
- Learning logic can produce a hypothesis or intervention decision with cited evidence.
- Evaluation can distinguish baseline, post, delayed, and transfer attempts.
