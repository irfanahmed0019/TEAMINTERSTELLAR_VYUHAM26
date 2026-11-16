import type { Profile } from "@/lib/loop-types";
import { EXPLORING_JOB, jobChoices } from "@/lib/target-job";

type Value = Pick<Profile, "targetJob" | "learningStack">;
export function TargetJobFields({
  value,
  onChange,
}: {
  value: Value;
  onChange: (next: Value) => void;
}) {
  const known = jobChoices.some(
    (c) => c.role === value.targetJob && c.role !== "Other job",
  );
  const selected = value.targetJob
    ? known
      ? value.targetJob
      : "Other job"
    : "";
  const field =
    "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
  return (
    <fieldset className="space-y-3 rounded-2xl border border-primary/20 bg-background p-4">
      <legend className="px-1 text-sm font-bold">Which job do you want?</legend>
      <p className="text-xs leading-5 text-muted-foreground">
        Choose your direction, even if your resume only lists C. These are tools
        to learn, not skills we assume you already have.
      </p>
      <label className="block text-xs font-semibold">
        Target job
        <select
          aria-label="Target job"
          className={field}
          value={selected}
          onChange={(e) => {
            const choice = jobChoices.find((c) => c.role === e.target.value);
            onChange({
              targetJob: choice?.role ?? "",
              learningStack: choice?.stack ?? "",
            });
          }}
        >
          <option value="">Choose a job or keep exploring</option>
          {jobChoices.map((c) => (
            <option key={c.role} value={c.role}>
              {c.role}
            </option>
          ))}
        </select>
      </label>
      {selected === "Other job" && (
        <label className="block text-xs font-semibold">
          Your job goal
          <input
            aria-label="Your job goal"
            className={field}
            maxLength={120}
            value={
              value.targetJob === "Other job" ? "" : (value.targetJob ?? "")
            }
            placeholder="For example, mobile app developer"
            onChange={(e) =>
              onChange({ ...value, targetJob: e.target.value || "Other job" })
            }
          />
        </label>
      )}
      {!!value.targetJob && (
        <label className="block text-xs font-semibold">
          Tools you want to learn for this goal
          {value.targetJob === EXPLORING_JOB ? " (optional)" : ""}
          <input
            aria-label="Learning stack"
            className={field}
            maxLength={200}
            value={value.learningStack ?? ""}
            placeholder="For example, JavaScript and React"
            onChange={(e) =>
              onChange({ ...value, learningStack: e.target.value })
            }
          />
          <span className="mt-1 block font-normal leading-5 text-muted-foreground">
            Suggested tools are editable. Your resume claims and checked
            practice stay separate.
          </span>
        </label>
      )}
    </fieldset>
  );
}
