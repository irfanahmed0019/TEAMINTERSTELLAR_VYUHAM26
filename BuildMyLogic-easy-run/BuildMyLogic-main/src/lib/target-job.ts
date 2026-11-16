import type { Profile } from "./loop-types";

export const jobChoices = [
  {
    role: "Python Developer",
    stack: "Python, SQLite, pytest",
    project: "Python Expense Tracker",
  },
  {
    role: "Frontend developer",
    stack: "HTML, CSS, JavaScript",
    project: "Accessible Job Application Tracker",
  },
  {
    role: "Backend developer",
    stack: "Python, SQLite",
    project: "Job Application API",
  },
  {
    role: "Full-stack developer",
    stack: "JavaScript, Node.js, SQLite",
    project: "Job Application Web App",
  },
  {
    role: "Data analyst",
    stack: "Python, SQL",
    project: "Job Listings Data Report",
  },
  {
    role: "QA / test engineer",
    stack: "Python, pytest",
    project: "Form Validation Test Suite",
  },
  {
    role: "Embedded / systems developer",
    stack: "C",
    project: "Simulated Sensor Alert Monitor",
  },
  { role: "Other job", stack: "", project: "" },
  { role: "Exploring / not job-focused", stack: "", project: "" },
] as const;
export const EXPLORING_JOB = "Exploring / not job-focused";
export function hasTargetJob(
  profile: Pick<Profile, "targetJob" | "learningStack">,
) {
  return (
    !!profile.targetJob?.trim() &&
    profile.targetJob !== "Other job" &&
    (profile.targetJob === EXPLORING_JOB || !!profile.learningStack?.trim())
  );
}
/** A future learning choice, never a change to reported or assessed abilities. */
export function projectStack(profile: Profile): string {
  if (profile.targetJob?.trim())
    return (
      profile.learningStack?.trim() || "tools to be chosen with the learner"
    );
  return (
    profile.technologies
      .map((t) => t.name.trim())
      .filter(Boolean)
      .join(", ") || "the learner's stated project requirements"
  );
}
export function targetJobBrief(profile: Profile) {
  return profile.targetJob?.trim()
    ? `Target job selected by learner: ${profile.targetJob}. Future learning stack: ${projectStack(profile)}. This is a learning goal, NOT existing ability. Use resume skills only as a starting point. Include beginner bridge steps for new tools; never require projects to stay in the resume language. Do not claim job readiness from finite checks.`
    : "Target job not chosen. Do not infer a career goal from resume languages.";
}
export function targetProject(profile: Profile) {
  const choice = jobChoices.find((c) => c.role === profile.targetJob);
  if (choice?.project) return choice.project;
  return profile.targetJob && profile.targetJob !== EXPLORING_JOB
    ? `Starter portfolio project for ${profile.targetJob}`
    : "";
}
