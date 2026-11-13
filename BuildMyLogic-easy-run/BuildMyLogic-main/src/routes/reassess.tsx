import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAuthSession, getAuthSessionForApi } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { TopicPractice } from "@/components/learn/TopicPractice";
import {
  applyBuildSessionEvidence,
  getLoopState,
  useLoop,
} from "@/lib/loop-store";
import { supportedTransferLanguage } from "@/lib/struggle-engine";
import { STUDY_TOPICS } from "@/lib/topic-library";
import type { BuildSessionState } from "@/lib/loop-types";

export const Route = createFileRoute("/reassess")({ component: Reassess });
function Reassess() {
  const state = useLoop();
  const [params] = useState(
    () =>
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      ),
  );
  const [status, setStatus] = useState("");
  const session = params.get("session");
  const pattern = params.get("pattern");
  const planIdentity = state.plan?.projectTitle;
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setStatus("Checking the linked VS Code session...");
    void (async () => {
      const auth = await getAuthSessionForApi();
      const headers: Record<string, string> = {};
      if (auth?.idToken) headers["Authorization"] = `Bearer ${auth.idToken}`;
      return fetch(
        `/api/sessions/${encodeURIComponent(session)}/recovery-state`,
        { cache: "no-store", headers },
      );
    })()
      .then(async (response) => {
        const result = (await response.json()) as {
          ok?: boolean;
          state?: BuildSessionState;
          error?: string;
        };
        if (cancelled) return;
        if (
          !response.ok ||
          !result.ok ||
          !result.state ||
          result.state.session_id !== session
        )
          throw new Error(result.error || "Could not verify this session.");
        if (
          !getLoopState().plan?.missions.some(
            (m) => m.id === result.state!.challenge_id,
          )
        )
          throw new Error(
            "This session does not belong to the plan loaded in this browser. Open the website with the same learner profile; no history was imported.",
          );
        applyBuildSessionEvidence(result.state);
        setStatus(
          "Linked session checked. Only recorded attempts are imported; reloading does not count as another attempt.",
        );
      })
      .catch((error) => {
        if (!cancelled)
          setStatus(
            error instanceof Error ? error.message : "Session check failed.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [session, planIdentity]);
  const patterns = (state.struggle?.misconceptions ?? []).filter(
    (m) =>
      m.status === "locked" &&
      (pattern
        ? m.id === pattern
        : session
          ? m.sourceSessionId === session
          : true),
  );
  return (
    <AppShell
      crumb="Recover"
      title="Diagnose, then adapt"
      subtitle="A prediction probe is evidence about a specific idea. An output mismatch alone is not a diagnosis."
    >
      {status && (
        <p role="status" className="card-surface mb-4 p-4 text-sm">
          {status}
        </p>
      )}
      {!patterns.length && (
        <section className="card-surface p-6">
          <h2 className="font-bold">No linked locked pattern is available.</h2>
          <p className="mt-2 text-sm">
            This may be a first failure, a completed recovery, a different
            browser profile, or a session without enough recorded similar
            failures. No weakness or conquest is invented.
          </p>
          <a href="/progress" className="btn-base btn-outline mt-4 text-xs">
            See all recorded progress
          </a>
        </section>
      )}
      {patterns.map((m) => {
        const topic = STUDY_TOPICS.find(
          (t) =>
            t.id ===
            (m.transferTopicId ?? (m.sourceSessionId ? "" : m.topicId)),
        );
        const lang = supportedTransferLanguage(m.language);
        const verified =
          !m.sourceSessionId ||
          Boolean(
            m.recoveryOwnerId && m.recoveryOwnerId === getAuthSession()?.uid,
          );
        return (
          <section key={m.id} className="mb-6">
            <div className="card-surface mb-4 p-5">
              <h2 className="font-bold">{m.summary}</h2>
              <p className="mt-2 text-sm">
                Original context: {m.topicTitle}.{" "}
                {m.sourceSessionId
                  ? `VS Code session ${m.sourceSessionId}.`
                  : "Website practice."}
              </p>
              {!verified ? (
                <p className="mt-3 text-sm text-amber-800">
                  This earlier session evidence is not verified for the
                  currently signed-in owner. It cannot conquer a pattern or be
                  promoted by signing in later. Open the owner-authenticated
                  session handoff to import separately verified event evidence;
                  old unsigned records remain unverified.
                </p>
              ) : !topic || !lang ? (
                <p className="mt-3 text-sm text-amber-800">
                  This project or checkpoint has no verified concept-specific
                  transfer specification yet. Its lock stays active. A generic
                  command succeeding, a chosen study topic, or a recovery
                  mission completing cannot prove this exact weakness was fixed.
                  Return to the project, capture the failing input or behavior
                  plus expected result, and verify a changed requirement with an
                  executable check. This handoff does not run or certify
                  arbitrary framework projects.
                </p>
              ) : (
                <p className="mt-3 text-sm">
                  Recovery scope: {topic.title} in{" "}
                  {lang === "c" ? "C" : "Python"}. Passing the finite checks
                  does not prove the entire original project works.
                </p>
              )}
            </div>
            {verified && topic && lang && (
              <TopicPractice
                patternId={m.id}
                topicId={topic.id}
                topicTitle={topic.title}
                language={lang}
                exercise={topic.exercise[lang]}
              />
            )}
          </section>
        );
      })}
    </AppShell>
  );
}
