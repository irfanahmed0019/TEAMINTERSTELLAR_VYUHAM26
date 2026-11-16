import { Link } from "@tanstack/react-router";
import type { Profile } from "@/lib/loop-types";
import { hasTargetJob, projectStack, targetProject } from "@/lib/target-job";

export function TargetJobRecommendation({
  profile,
}: {
  profile: Profile | null;
}) {
  const chosen = profile && hasTargetJob(profile);
  const project = profile && targetProject(profile);
  return (
    <section
      className="card-surface mb-5 p-5"
      aria-label="Target job recommendations"
    >
      <h2 className="text-base font-bold">
        {chosen
          ? `Your direction: ${profile.targetJob}`
          : "Which job do you want?"}
      </h2>
      {chosen && project ? (
        <>
          <p className="mt-2 text-sm font-semibold">
            Suggested next project: {project}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tools to learn: {projectStack(profile)}. Start with setup and small
            exercises for any new tools. This is a goal, not a claim that you
            already know them.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {chosen
            ? "You can keep exploring. Choose a job later, or name the tools you want to learn."
            : "Choose a target job in Settings. Your resume is a starting point, not a rule that every project must use the same language."}
        </p>
      )}
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Your current plan and learning history stay unchanged. This suggestion
        does not start or complete a project, and no AI request runs when you
        save a goal.
      </p>
      <Link
        to="/settings"
        className="mt-3 inline-block text-sm font-semibold text-primary"
      >
        {chosen ? "Change target job" : "Choose target job"}
      </Link>
    </section>
  );
}
