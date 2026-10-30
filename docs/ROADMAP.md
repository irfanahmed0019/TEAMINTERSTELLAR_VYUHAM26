# Roadmap

All stages below are planned. The repository has no application implementation, so sequencing may change once the team selects a narrow learning domain and stack.

## Stage 1: Foundation

- Maintain repository setup and documentation.
- Agree on the MVP domain, learner-event contract, privacy boundaries, and minimal stack.
- Record architecture decisions and allocate independent workstreams.

**Exit signal:** the team can build against documented contracts without assuming unimplemented infrastructure.

## Stage 2: Learner Assessment

- Create a baseline assessment for the selected domain.
- Represent attempts, correctness, confidence if collected, timing, and concept tags.
- Derive a transparent concept-level knowledge view from those events.

**Exit signal:** a learner’s baseline results can be represented and inspected by concept.

## Stage 3: Adaptive Learning

- Define a small, evidence-based set of misconception patterns.
- Deliver personalized explanations appropriate to a selected pattern or knowledge gap.
- Select exercises based on learner evidence rather than a fixed order.

**Exit signal:** at least one learner path demonstrably differs from a fixed sequence, with a recorded reason.

## Stage 4: Agent Orchestration

- Decide what the learner needs next.
- Select an appropriate intervention.
- Evaluate its immediate outcome.
- Record the decision, input evidence, and reasoning.

**Exit signal:** the assess-to-next-action loop works for the MVP without opaque, unreproducible decisions.

## Stage 5: Revision and Retention

- Implement or simulate spaced revision scheduling suitable for the demo timeline.
- Use delayed equivalent assessments where feasible.
- Track mastery and retention separately from immediate quiz performance.

**Exit signal:** the demo can show a scheduled revisit and capture delayed evidence.

## Stage 6: Evaluation and Demonstration

- Compare the adaptive path with a fixed explanation-and-exercise sequence.
- Measure immediate improvement, delayed retention, and transfer to unfamiliar problems.
- Prepare a reproducible demonstration, limitations statement, and data-handling explanation.

**Exit signal:** judges can understand what was measured, what was observed, and what remains uncertain.
