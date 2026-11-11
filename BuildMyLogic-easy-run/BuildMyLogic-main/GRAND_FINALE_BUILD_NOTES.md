# BuildMyLogic — Grand Finale build notes

## Experience flow
1. Conversational onboarding opens first.
2. The learner describes a goal, experience level and available time.
3. BuildMyLogic creates a personalized plan.
4. The learner reviews the plan and selects **I'm Ready**.
5. A short dashboard preparation sequence plays before entering Home.

## Product navigation
Home · Learn · AI Mentor · My Progress · Sessions
Settings remains separate at the bottom.

## Product behavior
Assess → Identify gaps → Assign practical work → Observe evidence → Evaluate → Adapt.

## Important implementation note
AI generation depends on a configured server-side provider credential. If no credential is configured or the provider is unavailable, existing curated fallback behavior may be used. Do not present fallback content as live AI-generated output.

## Branding
The user-facing product is branded as BuildMyLogic. Provider attribution and promotional provider labels are not part of the interface.
