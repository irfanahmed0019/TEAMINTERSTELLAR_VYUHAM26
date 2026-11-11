import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  Code2,
  ExternalLink,
  Layers,
  Lock,
  Play,
  Sparkles,
  Target,
  Terminal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CameraVideo } from "@/components/CameraVideo";
import { TopicPractice } from "@/components/learn/TopicPractice";
import { selectLearningMission, useLoop } from "@/lib/loop-store";
import type { Mission } from "@/lib/loop-types";
import { getAuthSessionForApi } from "@/lib/auth";
import {
  STUDY_TOPICS,
  topicMatchesSkills,
  type TopicLanguage,
} from "@/lib/topic-library";

export const Route = createFileRoute("/learn")({
  head: () => ({ meta: [{ title: "Learn — BuildMyLogic" }] }),
  component: Learn,
});

function PythonMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <img
      src="/python-logo.png"
      alt=""
      className={`${className} object-contain`}
    />
  );
}

function Learn() {
  const state = useLoop();
  const missions = state.plan?.missions ?? [];
  const activeMission =
    missions.find((m) => state.missionProgress[m.id]?.status === "active") ??
    missions[0];
  const [tab, setTab] = useState<"syllabus" | "topics" | "resources">("topics");
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [language, setLanguage] = useState<TopicLanguage | null>(null);
  const [videoIndex, setVideoIndex] = useState(0);
  const [vscodeSession, setVscodeSession] = useState<{
    sessionId: string;
    challengeId: string;
    status?: string;
  } | null>(null);
  const [vscodeLoading, setVscodeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPythonPlan = /python/i.test(
    `${state.plan?.projectTitle ?? ""} ${activeMission?.stack ?? ""} ${missions.map((m) => m.stack).join(" ")}`,
  );
  const lang: TopicLanguage = language ?? (isPythonPlan ? "python" : "c");
  const activeTopic = activeTopicId
    ? STUDY_TOPICS.find((t) => t.id === activeTopicId)
    : undefined;

  const allSkills = useMemo(() => {
    const fromPlan = (state.plan?.skills ?? []).map((s) => s.name);
    const fromMissions = missions.flatMap((m) => m.skills);
    return [...new Set([...fromPlan, ...fromMissions])];
  }, [state.plan, missions]);

  const { syllabusTopics, otherTopics } = useMemo(() => {
    const inSyllabus = STUDY_TOPICS.filter((t) =>
      topicMatchesSkills(t, allSkills),
    );
    const rest = STUDY_TOPICS.filter((t) => !topicMatchesSkills(t, allSkills));
    return { syllabusTopics: inSyllabus, otherTopics: rest };
  }, [allSkills]);

  if (!state.plan || !activeMission) {
    return (
      <AppShell
        crumb="Learn"
        title="Your Learning Path"
        subtitle="Build skills step by step, with practical tasks and real projects."
        quote="Learn by doing, not just by watching."
      >
        <section className="card-surface p-10 text-center">
          <BookOpen className="mx-auto h-9 w-9 text-primary" />
          <h2 className="display mt-4 text-2xl font-black">
            Your learning path is waiting.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold">
            Finish onboarding and BuildMyLogic will connect learning directly to
            your first mission.
          </p>
          <Link to="/" className="btn-base btn-primary-solid mt-5">
            Start onboarding
          </Link>
        </section>
      </AppShell>
    );
  }

  const current = activeMission;
  const doneCount = missions.filter(
    (m) => state.missionProgress[m.id]?.status === "done",
  ).length;
  const pathPct = missions.length
    ? Math.round((doneCount / missions.length) * 100)
    : 0;
  const activeStepsDone =
    state.missionProgress[activeMission.id]?.completedSteps?.length ?? 0;
  const activeStepsTotal = activeMission.steps.length || 1;
  const projectPct = Math.min(
    100,
    Math.round((activeStepsDone / activeStepsTotal) * 100),
  );
  const goals: [string, boolean][] = [
    [
      "Complete the current topic",
      state.missionProgress[activeMission.id]?.status === "done",
    ],
    ["Log at least one practice session", state.sessions.length > 0],
    ["Make progress on the current project", activeStepsDone > 0],
  ];
  const goalsDone = goals.filter(([, done]) => done).length;

  function chooseMission(mission: Mission) {
    selectLearningMission(mission.id);
    setActiveTopicId(null);
    setTab("topics");
  }

  /* ------------------------------ Topic study view ------------------------------ */
  if (activeTopic) {
    const videos = activeTopic.videos[lang];
    const video = videos[Math.min(videoIndex, videos.length - 1)]!;
    const inSyllabus = topicMatchesSkills(activeTopic, allSkills);
    return (
      <AppShell
        crumb={`Learn › ${activeTopic.title}`}
        title={activeTopic.title}
        subtitle={activeTopic.summary}
        quote={state.plan.quote}
        wide
      >
        <div className="mx-auto flex max-w-[980px] flex-col">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveTopicId(null);
                setVideoIndex(0);
              }}
              className="btn-base btn-outline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to topics
            </button>
            <div className="flex items-center gap-2">
              {inSyllabus && (
                <span className="pill bg-primary-soft font-bold text-accent-foreground">
                  In your syllabus
                </span>
              )}
              <div className="inline-flex rounded-xl border border-border bg-card p-1">
                {(["c", "python"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setLanguage(l);
                      setVideoIndex(0);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${lang === l ? "bg-primary-soft text-accent-foreground" : "text-muted-foreground"}`}
                  >
                    {l === "c" ? "C" : "Python"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <section className="card-surface p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-[18px] w-[18px] text-primary" />
              <h2 className="text-[16px] font-extrabold">
                Notes - {activeTopic.title} in {lang === "c" ? "C" : "Python"}
              </h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {activeTopic.notes[lang].points.map((point, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-[14px] font-medium leading-6"
                >
                  <Check
                    className="mt-1 h-4 w-4 shrink-0 text-primary"
                    strokeWidth={3}
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[12px] font-black uppercase tracking-widest text-muted-foreground">
              {activeTopic.notes[lang].codeTitle}
            </p>
            <pre className="learn-code-block mt-2">
              <code>{activeTopic.notes[lang].code}</code>
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              {activeTopic.docs[lang].map((doc) => (
                <a
                  key={doc.url}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-base btn-outline text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {doc.label}
                </a>
              ))}
            </div>
          </section>

          {/* Video lesson with camera presence sync */}
          <section className="card-surface mt-4 p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <Camera className="h-[18px] w-[18px] text-primary" />
              <h2 className="text-[16px] font-extrabold">
                Video lesson - watch with your camera on
              </h2>
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              The video pauses when you move away and resumes when you're back,
              so you actually watch it.
            </p>
            {videos.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {videos.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVideoIndex(i)}
                    className={`rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition ${i === videoIndex ? "border-primary bg-primary-soft text-accent-foreground" : "border-border text-muted-foreground hover:border-primary"}`}
                  >
                    {v.title} · {v.channel} · {v.minutes} min
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4">
              <CameraVideo
                key={`${activeTopic.id}-${lang}-${video.id}`}
                videoId={video.id}
                title={`${video.title} - ${video.channel}`}
              />
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open on YouTube
            </a>
          </section>

          {/* Practice */}
          <section className="card-surface mt-4 p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <Code2 className="h-[18px] w-[18px] text-primary" />
              <h2 className="text-[16px] font-extrabold">
                Practice - make sure you really get it
              </h2>
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              One basic task from your mentor on exactly this topic. Run your
              code for real, then submit - it checks your actual output and
              explains mistakes before you move on.
            </p>
            <div className="mt-4">
              <TopicPractice
                key={`${activeTopic.id}-${lang}`}
                topicTitle={activeTopic.title}
                language={lang}
                exercise={activeTopic.exercise[lang]}
              />
            </div>
          </section>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
            <Link to="/mentor" className="btn-base btn-outline text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Ask the AI Mentor
            </Link>
            <Link
              to="/mentor"
              search={{ view: "practice", topic: activeTopic.id, lang }}
              className="btn-base btn-primary-solid text-xs font-bold"
            >
              <Code2 className="h-4 w-4" />
              Switch to practice workspace
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ------------------------------ Tabs view ------------------------------ */
  return (
    <AppShell
      crumb="Learn"
      title="Your Learning Path"
      subtitle="Your syllabus, notes, references and video lessons - study each topic, then practice it."
      quote="Learn by doing, not just by watching."
      wide
    >
      {/* Tabs */}
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1.5">
        {(
          [
            { id: "syllabus", label: "Syllabus", icon: BookOpen },
            { id: "topics", label: "Topics", icon: Layers },
            { id: "resources", label: "Resources", icon: Play },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition ${tab === id ? "bg-primary-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Main column */}
        <div className="lg:col-span-7 xl:col-span-8">
          {tab === "syllabus" && (
            <>
              <section className="card-surface flex items-center gap-4 p-5 sm:p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  {isPythonPlan ? (
                    <PythonMark className="h-8 w-8" />
                  ) : (
                    <Code2 className="h-6 w-6" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="display text-[19px] font-extrabold tracking-[-0.02em]">
                    {state.plan.projectTitle} Path
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Your current syllabus - from basics to building real
                    projects.
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-bold">{pathPct}% Complete</p>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pathPct}%` }}
                    />
                  </div>
                </div>
              </section>

              <h3 className="display mt-6 text-[19px] font-extrabold tracking-[-0.02em]">
                Syllabus
              </h3>
              <div className="mt-4 space-y-3">
                {missions.map((mission, index) => {
                  const status =
                    state.missionProgress[mission.id]?.status ??
                    (index === 0 ? "active" : "locked");
                  const isDone = status === "done";
                  const isActive = !isDone && mission.id === activeMission.id;
                  const locked = !isDone && !isActive && status === "locked";
                  const isLast = index === missions.length - 1;
                  const prevDone =
                    index > 0 &&
                    state.missionProgress[missions[index - 1]!.id]?.status ===
                      "done";
                  return (
                    <button
                      key={mission.id}
                      type="button"
                      onClick={() => chooseMission(mission)}
                      className={`flex w-full items-stretch rounded-2xl border bg-card text-left transition hover:border-primary ${isActive ? "border-primary/40 bg-primary-soft/50 shadow-sm" : "border-border"}`}
                    >
                      <span className="relative flex w-14 shrink-0 flex-col items-center self-stretch sm:w-16">
                        {index > 0 && (
                          <span
                            aria-hidden
                            className={`w-0.5 flex-none basis-4 sm:basis-5 ${prevDone ? "bg-emerald-400" : "bg-border"}`}
                          />
                        )}
                        {index === 0 && (
                          <span aria-hidden className="basis-4 sm:basis-5" />
                        )}
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            isDone
                              ? "bg-emerald-500 text-white"
                              : isActive
                                ? "border-[3px] border-primary bg-card"
                                : "border border-border bg-muted"
                          }`}
                        >
                          {isDone && (
                            <Check className="h-4 w-4" strokeWidth={3.2} />
                          )}
                        </span>
                        {!isLast && (
                          <span
                            aria-hidden
                            className={`absolute bottom-[-12px] left-1/2 top-[48px] w-0.5 -translate-x-1/2 sm:top-[52px] ${isDone ? "bg-emerald-400" : "bg-border"}`}
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 py-4 sm:py-5">
                        <p className="text-[15px] font-bold">
                          {index + 1}. {mission.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                          {mission.description}
                        </p>
                        {mission.skills.length > 0 && (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {mission.skills.map((skill) => (
                              <span
                                key={skill}
                                className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10.5px] font-bold"
                              >
                                {skill}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 pr-4 sm:pr-5">
                        {isDone ? (
                          <span className="pill shrink-0 bg-emerald-100 font-bold text-emerald-700">
                            Completed
                          </span>
                        ) : isActive ? (
                          <span className="pill shrink-0 bg-primary-soft font-bold text-accent-foreground">
                            In Progress
                          </span>
                        ) : locked ? (
                          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : null}
                        {!locked && (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 text-center">
                <Link
                  to="/missions"
                  className="btn-base btn-outline rounded-full px-6"
                >
                  View Full Roadmap <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          )}

          {tab === "topics" && (
            <>
              <section className="card-surface p-5 sm:p-6">
                <h2 className="display text-[19px] font-extrabold tracking-[-0.02em]">
                  Study topics for {current.title}
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Pick a topic to open its notes, references and video lesson -
                  then practice it with a real checked task.
                </p>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {syllabusTopics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => {
                        setActiveTopicId(topic.id);
                        setVideoIndex(0);
                      }}
                      className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xl">{topic.emoji}</span>
                        <span className="pill bg-primary-soft text-[10px] font-bold text-accent-foreground">
                          In your syllabus
                        </span>
                      </span>
                      <p className="mt-2 text-[14px] font-bold">
                        {topic.title}
                      </p>
                      <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
                        {topic.summary}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
              {otherTopics.length > 0 && (
                <section className="card-surface mt-4 p-5 sm:p-6">
                  <h2 className="display text-[19px] font-extrabold tracking-[-0.02em]">
                    More fundamentals
                  </h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Extra topics that come up in almost every project.
                  </p>
                  <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    {otherTopics.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => {
                          setActiveTopicId(topic.id);
                          setVideoIndex(0);
                        }}
                        className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary"
                      >
                        <span className="text-xl">{topic.emoji}</span>
                        <p className="mt-2 text-[14px] font-bold">
                          {topic.title}
                        </p>
                        <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
                          {topic.summary}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {tab === "resources" && (
            <div className="space-y-4">
              <Link
                to="/videos"
                className="card-surface flex items-center gap-4 p-5 transition hover:border-primary"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Camera className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">
                    Watch the full course video
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    The complete beginner course with camera pause/resume.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
              <Link
                to="/mentor"
                search={{ view: "workspace" }}
                className="card-surface flex items-center gap-4 p-5 transition hover:border-primary"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Sparkles className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">
                    Practice workspace (C)
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Guided C exercises with real test runs, checked by the
                    mentor.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
              <a
                href="/extension.html"
                className="card-surface flex items-center gap-4 p-5 transition hover:border-primary"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Code2 className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">VS Code extension</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Install once to run checkpoints locally and sync real
                    evidence from your editor.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
              <section className="card-surface p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  <h2 className="text-sm font-black">Build with VS Code</h2>
                  {vscodeSession && (
                    <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700">
                      ●{" "}
                      {vscodeSession.status === "active" ||
                      vscodeSession.status === "connected"
                        ? "CONNECTED"
                        : "READY"}
                    </span>
                  )}
                </div>
                {!vscodeSession ? (
                  <>
                    <p className="mb-3 text-xs font-semibold text-muted-foreground">
                      Open the existing BuildMyLogic extension with the same
                      challenge. Only the Session ID is needed.
                    </p>
                    <button
                      type="button"
                      disabled={vscodeLoading}
                      onClick={async () => {
                        setVscodeLoading(true);
                        try {
                          const auth = await getAuthSessionForApi();
                          const headers: Record<string, string> = {
                            "content-type": "application/json",
                          };
                          if (auth?.idToken)
                            headers["Authorization"] = `Bearer ${auth.idToken}`;
                          const res = await fetch("/api/sessions/start", {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                              challenge_id: current.id,
                              user_id: auth?.uid || "local-user",
                              title: current.title,
                              language: current.stack,
                              concept: current.skills?.[0] || "problem solving",
                              instructions:
                                current.description +
                                "\n\nRequirements:\n" +
                                current.steps
                                  .map(
                                    (step) => `• ${step.title}: ${step.detail}`,
                                  )
                                  .join("\n"),
                              expected_skills: current.skills,
                            }),
                          });
                          const data = (await res.json()) as {
                            ok?: boolean;
                            session_id?: string;
                            error?: string;
                          };
                          if (!res.ok || !data.ok || !data.session_id)
                            throw new Error(
                              data.error ||
                                "Could not start the VS Code session.",
                            );
                          const next = {
                            sessionId: data.session_id,
                            challengeId: current.id,
                            status: "waiting",
                          };
                          setVscodeSession(next);
                          const anchor = document.createElement("a");
                          anchor.href = `vscode://buildmylogic.buildmylogic/connect?sessionId=${encodeURIComponent(next.sessionId)}&apiBaseUrl=${encodeURIComponent(window.location.origin)}`;
                          anchor.click();
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Could not open the VS Code session.",
                          );
                        } finally {
                          setVscodeLoading(false);
                        }
                      }}
                      className="btn-base btn-ink w-full text-xs"
                    >
                      {vscodeLoading
                        ? "Opening VS Code…"
                        : "Open session in VS Code"}
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-black text-green-700">
                      ✅ Session ID ready. VS Code is opening the same mission.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const anchor = document.createElement("a");
                        anchor.href = `vscode://buildmylogic.buildmylogic/connect?sessionId=${encodeURIComponent(vscodeSession.sessionId)}&apiBaseUrl=${encodeURIComponent(window.location.origin)}`;
                        anchor.click();
                      }}
                      className="btn-base btn-outline w-full text-xs"
                    >
                      Open VS Code again
                    </button>
                    <button
                      type="button"
                      onClick={() => setVscodeSession(null)}
                      className="w-full text-center text-[10px] font-bold text-muted-foreground hover:text-destructive"
                    >
                      Start a new session
                    </button>
                  </div>
                )}
                {error && (
                  <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-700">
                    {error}
                  </p>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside className="space-y-5 lg:col-span-5 xl:col-span-4">
          <section className="card-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Layers className="h-[18px] w-[18px] text-primary" />
                <h3 className="text-[15px] font-extrabold">Current Project</h3>
              </div>
              <span className="pill bg-primary-soft text-accent-foreground">
                In Progress
              </span>
            </div>
            <div className="mt-4 flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                {isPythonPlan ? (
                  <PythonMark className="h-7 w-7" />
                ) : (
                  <Terminal className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold">{activeMission.title}</p>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">
                  {activeMission.description}
                </p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${projectPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-[12px] font-bold">
              {projectPct}%
            </p>
            <Link
              to="/sessions"
              className="btn-base btn-primary-solid mt-2 w-full text-xs font-bold"
            >
              Open Sessions <ArrowUpRight className="h-4 w-4" />
            </Link>
          </section>

          <section className="card-surface p-5">
            <div className="flex items-center gap-2.5">
              <Target className="h-[18px] w-[18px] text-primary" />
              <h3 className="text-[15px] font-extrabold">Next Milestone</h3>
            </div>
            <p className="mt-3 text-[14px] font-bold">
              Complete {activeMission.title}
            </p>
            <div className="mt-3 space-y-2.5">
              {activeMission.steps.slice(0, 3).map((step, index) => {
                const done =
                  state.missionProgress[
                    activeMission.id
                  ]?.completedSteps?.includes(index) ?? false;
                return (
                  <div key={step.title} className="flex items-center gap-2.5">
                    <span
                      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {done && (
                        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                      )}
                    </span>
                    <p
                      className={`text-[13px] ${done ? "font-semibold" : "text-muted-foreground"}`}
                    >
                      {step.title}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="h-[18px] w-[18px] text-primary" />
                <h3 className="text-[15px] font-extrabold">Learning Goals</h3>
              </div>
              <span className="pill bg-primary-soft text-accent-foreground">
                {goalsDone} / {goals.length}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Your targets for this week.
            </p>
            <div className="mt-3 space-y-2.5">
              {goals.map(([label, done]) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                  >
                    {done && (
                      <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                    )}
                  </span>
                  <p
                    className={`text-[13px] ${done ? "font-semibold" : "text-muted-foreground"}`}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
