import { isReadyCloudOwner } from "@/lib/cloud-readiness";
import { useState, useRef, useEffect } from "react";
import { useAuth, getAuthSession, getAuthSessionForApi } from "@/lib/auth";
import { useCloudHydrated } from "@/lib/cloud-sync";
import {
  useLoop,
  applyBuildSessionEvidence,
  getLoopState,
  saveProjectRecoveryReview,
} from "@/lib/loop-store";
import { saveLearnerStateToSupabase } from "@/lib/supabase";
import {
  PROJECT_RECOVERY_PREDICTION as probe,
  projectBinding,
  projectRecoveryPattern,
  projectRecoverySessions,
  validProjectReview,
  type PartitionedRepair,
} from "@/lib/project-recovery";
import type { BuildSessionState } from "@/lib/loop-types";

export function ProjectRecoveryLessons({
  sessionId,
}: {
  sessionId?: string | undefined;
}) {
  const auth = useAuth(),
    hydrated = useCloudHydrated(auth?.uid),
    state = useLoop();
  if (!auth || !hydrated || state.sampleProvenance) return null;
  const sessions = projectRecoverySessions(state, auth.uid, sessionId);
  if (!sessions.length) return null;
  return (
    <section
      className="my-5 space-y-4"
      aria-label="Project test repair learning"
    >
      <h2 className="text-xl font-extrabold">Learn from your project tests</h2>
      {sessions.map((remote) => (
        <ProjectRecoveryLesson
          key={remote.session_id}
          remote={remote}
          owner={auth.uid}
        />
      ))}
    </section>
  );
}
function ProjectRecoveryLesson({
  remote,
  owner,
}: {
  remote: BuildSessionState;
  owner: string;
}) {
  const state = useLoop();
  const [choice, setChoice] = useState<number | null>(null),
    [revealed, setRevealed] = useState(false),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const pattern = projectRecoveryPattern(state, remote, owner),
    binding = projectBinding(remote),
    review = validProjectReview(state, remote, owner);
  const conquered = state.struggle?.misconceptions.find(
    (m) =>
      m.sourceSessionId === remote.session_id &&
      m.recoveryOwnerId === owner &&
      m.projectRecheckReceiptId &&
      m.status === "conquered",
  );
  const constructs =
    (
      remote.project_context?.repair_contract as
        | (NonNullable<
            BuildSessionState["project_context"]
          >["repair_contract"] &
            PartitionedRepair)
        | undefined
    )?.constructs ?? [];
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [owner],
  );
  async function sync(enable = false) {
    const epoch = ++generation.current;
    const active = () =>
      generation.current === epoch &&
      getAuthSession()?.uid === owner &&
      isReadyCloudOwner(owner);
    setBusy(true);
    setStatus("");
    try {
      const current = await getAuthSessionForApi();
      if (!active()) return;
      if (current?.uid !== owner || !current.idToken)
        throw Error("Sign in as this project's owner before continuing.");
      if (enable) {
        if (choice !== probe.correct || !revealed)
          throw Error("Review the prediction first.");
        saveProjectRecoveryReview(remote.session_id, owner, choice);
        const snapshot = getLoopState();
        if (!validProjectReview(snapshot, remote, owner))
          throw Error(
            "Finish the initial repair and save a matching review first.",
          );
        if (!active()) return;
        const saved = await saveLearnerStateToSupabase(owner, snapshot);
        if (!active()) return;
        if (!saved)
          throw Error(
            "The review was not saved to your account. Nothing was enabled; retry when cloud save is available.",
          );
      }
      if (!active()) return;
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(remote.session_id)}/${enable ? "project-recheck-ready" : "recovery-state"}`,
        {
          method: enable ? "POST" : "GET",
          cache: "no-store",
          headers: {
            authorization: `Bearer ${current.idToken}`,
            "content-type": "application/json",
          },
          ...(enable ? { body: "{}" } : {}),
        },
      );
      if (!active()) return;
      const result = (await response.json()) as {
        ok?: boolean;
        state?: BuildSessionState;
        error?: string;
      };
      if (!active()) return;
      if (
        !response.ok ||
        !result.ok ||
        !result.state ||
        result.state.session_id !== remote.session_id ||
        result.state.verified_owner_id !== owner
      )
        throw Error(
          result.error || "The project session could not be checked.",
        );
      if (!active()) return;
      applyBuildSessionEvidence(result.state);
      setStatus(
        enable
          ? "Review saved and recheck enabled. In the connected VS Code extension choose Run changed-input recheck, then refresh here."
          : "Latest owner session imported. A changed-input pass is finite, extension-reported evidence, not whole-project certification.",
      );
    } catch (error) {
      if (!active()) return;
      setStatus(
        error instanceof Error ? error.message : "Project sync unavailable.",
      );
    } finally {
      if (active()) setBusy(false);
    }
  }
  return (
    <article className="card-surface p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-primary">
        {conquered
          ? "Recorded finite project recovery"
          : "Priority: repeated project test failures"}
      </p>
      <h3 className="mt-2 break-words text-lg font-bold">{remote.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Session {remote.session_id}. Python utility repair only. These notes
        explain how to use the actual project assertions; they do not diagnose
        why you made a mistake.
      </p>
      <ol className="ml-5 mt-4 list-decimal space-y-2 text-sm leading-6">
        <li>
          Read each assertion as a contract: the arguments are the input, the
          value after == is the project test's expected result. Do not change
          the test merely to make a failure disappear.
        </li>
        <li>
          Trace the selected function using one failing input. Compare the
          returned value with the expected value. Change the function body while
          keeping its signature and the approved test file unchanged.
        </li>
        <li>
          Run the initial repair cases in VS Code. A pass supports only those
          cases. Then check the reserved different inputs from the same reviewed
          project tests, with the same pinned source identity, signature and
          test file.
        </li>
      </ol>
      {constructs.length > 0 && (
        <p className="mt-3 text-sm">
          Constructs actually found in the inspected function:{" "}
          {constructs
            .filter((c) =>
              ["arithmetic", "conditionals", "string-normalization"].includes(
                c,
              ),
            )
            .join(", ")}
          . Their presence is context, not proof of the failure's cause.
        </p>
      )}
      <a
        className="mt-3 inline-block text-sm underline"
        href="https://docs.python.org/3/reference/simple_stmts.html#the-assert-statement"
        target="_blank"
        rel="noreferrer"
      >
        Python assertion reference
      </a>
      {conquered ? (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
          Changed-input project recheck passed. This project's recorded failure
          pattern is recovered on two reviewed existing test inputs, not secret
          or unseen tests, independent work, or general mastery.
        </p>
      ) : !binding ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          This older or small test contract has no separately reserved
          changed-input checks. Its finite repair pass cannot conquer this
          pattern. To use the new path, start a new explicitly partitioned task
          with at least four distinct approved test inputs, two reserved for the
          later recheck. No expected outputs are invented.
        </p>
      ) : (
        <>
          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-bold">{probe.question}</legend>
            {probe.options.map((text, i) => (
              <label
                key={text}
                className="flex gap-2 rounded-lg border p-3 text-sm"
              >
                <input
                  type="radio"
                  name={`project-probe-${remote.session_id}`}
                  checked={choice === i}
                  disabled={revealed}
                  onChange={() => setChoice(i)}
                />
                {text}
              </label>
            ))}
          </fieldset>
          <button
            className="btn-base btn-outline mt-3 text-xs"
            disabled={choice === null || revealed}
            onClick={() => setRevealed(true)}
          >
            Check prediction
          </button>
          {revealed && (
            <p className="mt-3 text-sm">
              {probe.model}{" "}
              {choice !== probe.correct &&
                "That prediction is not supported. Reset and predict again after reviewing the notes."}
            </p>
          )}
          {revealed && choice !== probe.correct && (
            <button
              className="btn-base btn-outline mt-3 text-xs"
              onClick={() => {
                setChoice(null);
                setRevealed(false);
              }}
            >
              Try prediction again
            </button>
          )}
          {remote.status !== "completed" && (
            <p className="mt-3 text-sm">
              Complete the initial project repair in VS Code, then refresh this
              session before enabling the changed-input recheck.
            </p>
          )}
          <button
            className="btn-base btn-primary-solid mt-3 text-xs"
            disabled={
              busy ||
              !pattern ||
              remote.status !== "completed" ||
              choice !== probe.correct ||
              !revealed
            }
            onClick={() => void sync(true)}
          >
            {review
              ? "Save review and retry enabling recheck"
              : "Save reviewed lesson and enable changed-input recheck"}
          </button>
        </>
      )}
      <button
        className="btn-base btn-outline ml-0 mt-3 block text-xs"
        disabled={busy}
        onClick={() => void sync(false)}
      >
        Refresh latest project result
      </button>
      {status && (
        <p role="status" className="mt-3 text-sm leading-6">
          {status}
        </p>
      )}
    </article>
  );
}
