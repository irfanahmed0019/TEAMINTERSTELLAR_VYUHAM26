# Evaluation Strategy

## Central question

**Do adaptive interventions improve mastery and long-term retention compared with a fixed-learning approach?**

This project must not claim improvement until it has collected and analyzed suitable evidence.

## Measures

| Measure | Definition | Why it matters |
| --- | --- | --- |
| Baseline performance | Pre-intervention score, ideally reported by concept. | Establishes starting knowledge and supports comparable groups or paths. |
| Immediate post-intervention performance | Equivalent assessment shortly after learning. | Measures near-term understanding, not durable learning alone. |
| Delayed retention | Equivalent assessment after a predeclared delay. | Tests whether learning persists. |
| Transfer | Performance on unfamiliar problems requiring the same concept. | Tests flexible application rather than memorization. |
| Confidence calibration (optional) | Alignment of stated confidence with correctness. | Can reveal overconfidence or uncertainty if confidence is collected. |

## Feasible MVP experiment

1. Give learners a tagged baseline assessment.
2. Assign learners—or, where samples are very small, matched learner sessions—to either an adaptive path or a fixed path.
   - **Adaptive path:** explanations and exercises are selected from baseline and ongoing evidence.
   - **Fixed path:** the same general content is delivered in a preset explanation-and-exercise order.
3. Keep time, content scope, and assessment opportunities as similar as practical.
4. Administer an immediate equivalent post-assessment.
5. Schedule a delayed equivalent follow-up at a predeclared interval feasible for the demo or study.
6. Include transfer items that differ in surface form but target the same concepts.
7. Report individual and aggregate changes, missing follow-ups, uncertainty, and limitations. Any simulated data in a hackathon demo must be unmistakably labeled simulated.

## Fair comparison and assessment quality

Use item sets that target the same concepts and approximate difficulty. Avoid reusing exact questions when that would reward recall. Randomize assignment when possible; otherwise describe matching or ordering rules and the risk of selection bias. Predefine scoring, the delay window, exclusion criteria, and whether hints count as assistance.

## Interpretation limits

Small samples are useful for usability and feasibility feedback but rarely justify broad causal claims. Report distributions or individual trajectories where aggregate statistics would mislead. A higher immediate score can reflect recent exposure, item familiarity, or guessing; delayed and transfer measures are needed to assess durable mastery.

## Privacy, bias, and uncertainty

Collect only learner data needed for the evaluation, avoid storing direct identifiers where possible, obtain appropriate consent, and restrict access to raw responses. Misconception labels are hypotheses based on incomplete evidence, not diagnoses of a learner. Evaluate whether patterns work differently across learner backgrounds, and do not use sensitive attributes to make unsupported inferences. Present confidence and uncertainty in both the product and evaluation report.
