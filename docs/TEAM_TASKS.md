# Team Task Board

All workstreams are **planned**, not completed. Suggested ownership means one accountable contributor or pair; no team members are assigned here. Agree shared contracts before parallel implementation.

## Shared integration boundaries

Use stable identifiers for learner, session, concept, assessment item, attempt, intervention, and revision event. The proposed flow is:

```text
learner event → knowledge/misconception evidence → intervention decision
→ delivered content → outcome event → scheduling and analytics
```

The exact schema and transport remain an open architecture decision. Changes to these boundaries should be documented and coordinated before integration.

## Learner assessment and knowledge tracking

- **Status:** Planned.
- **Objective:** capture baseline and ongoing evidence at concept level.
- **Responsibilities:** define item metadata and attempt events; score responses; produce a learner knowledge-state summary.
- **Inputs / outputs:** tagged assessment responses and optional confidence → scores, evidence, and concept-level state.
- **Dependencies:** needs an agreed domain and shared event identifiers; supplies diagnosis, orchestration, scheduling, and analytics.
- **Suggested ownership:** one assessment/data contributor.
- **Acceptance criteria:** a sample learner session can be scored and its per-concept evidence is inspectable and documented.

## AI tutor and explanation generation

- **Status:** Planned.
- **Objective:** provide explanations appropriate to a selected learner need.
- **Responsibilities:** create an explanation contract, content templates or generation approach, safety/quality checks, and a fallback when content is unavailable.
- **Inputs / outputs:** concept, learner level, and intervention intent → learner-facing explanation metadata and content.
- **Dependencies:** needs domain content and intervention selection; supplies the learner experience.
- **Suggested ownership:** one learning-content/AI contributor.
- **Acceptance criteria:** at least one explanation variant is traceable to an intervention reason and can be reviewed for correctness.

## Misconception detection

- **Status:** Planned.
- **Objective:** infer plausible conceptual errors from learner evidence without overstating certainty.
- **Responsibilities:** define detectable patterns, confidence/uncertainty rules, and explanatory labels.
- **Inputs / outputs:** tagged attempts and knowledge state → ranked possible misconceptions with supporting evidence.
- **Dependencies:** needs assessment item tags and feeds orchestration and analytics.
- **Suggested ownership:** one learning-logic contributor.
- **Acceptance criteria:** representative response patterns yield documented, testable inferences; ambiguous evidence is labeled uncertain.

## Agent decision-making and orchestration

- **Status:** Planned.
- **Objective:** select and record the next learning intervention.
- **Responsibilities:** implement the assess → diagnose → plan → teach → test → evaluate loop; choose rules; log decision reasoning.
- **Inputs / outputs:** learner state, misconceptions, and available interventions → selected intervention and rationale.
- **Dependencies:** integrates all workstreams and depends on agreed contracts first.
- **Suggested ownership:** one integrator.
- **Acceptance criteria:** a reproducible sample path selects different next steps for distinct learner evidence and records why.

## Revision scheduling

- **Status:** Planned.
- **Objective:** schedule concept revisits and delayed checks based on evidence.
- **Responsibilities:** define simple scheduling rules, due-event representation, and completion updates.
- **Inputs / outputs:** concept state and intervention outcomes → planned revision events and retention evidence.
- **Dependencies:** needs the knowledge-state contract; feeds learner experience and evaluation.
- **Suggested ownership:** one learning-logic contributor.
- **Acceptance criteria:** a completed concept can receive a documented future review, and its delayed result changes the recorded state.

## Frontend and learner experience

- **Status:** Planned.
- **Objective:** make assessment, intervention, feedback, and revision understandable to a learner.
- **Responsibilities:** deliver interaction flow, accessibility basics, loading/error states, and transparent feedback language.
- **Inputs / outputs:** assessments, content, decisions, and due revisions → learner events.
- **Dependencies:** can use mock contracts early; must align with final event contracts before integration.
- **Suggested ownership:** one frontend contributor.
- **Acceptance criteria:** a learner can complete the MVP flow and see why a next activity was selected without exposing sensitive internals.

## Evaluation, testing, and demonstration

- **Status:** Planned.
- **Objective:** make learning-impact claims measurable and bounded.
- **Responsibilities:** create equivalent assessment sets, fixed-path baseline, metrics, test cases, demo script, and limitations summary.
- **Inputs / outputs:** anonymized event/outcome data → comparison metrics and reproducible demo evidence.
- **Dependencies:** needs stable events and a working minimum flow; informs all contracts early.
- **Suggested ownership:** one evaluation/QA contributor.
- **Acceptance criteria:** the demo distinguishes immediate, delayed, and transfer outcomes and makes no unsupported efficacy claim.
