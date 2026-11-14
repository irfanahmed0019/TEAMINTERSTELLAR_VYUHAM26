import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { makeSampleProgress } from "@/lib/sample-progress";

export const Route = createFileRoute("/demo")({
  head: () => ({ meta: [{ title: "Public demo preview - BuildMyLogic" }] }),
  component: PublicDemo,
});

function PublicDemo() {
  const sample = useMemo(() => makeSampleProgress(1794614400000), []);
  const [tab, setTab] = useState("Overview");
  const plan = sample.plan!;
  const patterns = sample.struggle!.misconceptions;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div
        role="note"
        className="border-b border-amber-300 bg-amber-50 px-5 py-3 text-center text-sm font-semibold text-amber-950"
      >
        PUBLIC DEMO SESSION - synthetic sample data only. Not an authenticated
        account. Nothing here is saved to a learner account.
      </div>
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 border-b border-border px-5 py-5">
        <a href="/demo" className="text-xl font-black">
          BuildMyLogic<span className="text-primary">•</span>
        </a>
        <a
          href="/"
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold"
        >
          Exit demo
        </a>
      </header>
      <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Sample learning session
          </p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
            Welcome to the demo, builder.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Explore a full Python practice journey. These missions, sessions,
            skills and wins are synthetic examples, not real achievements. No
            password is checked, sent or saved in this public preview.
          </p>
        </div>
        <nav aria-label="Demo sections" className="flex flex-wrap gap-2">
          {["Overview", "Missions", "Sessions", "Struggle DNA"].map((label) => (
            <button
              key={label}
              onClick={() => setTab(label)}
              aria-pressed={tab === label}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${tab === label ? "border-primary bg-primary text-white" : "border-border bg-surface"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["3", "Sample projects"],
            ["12", "Sample sessions"],
            ["62%", "Sample mastery"],
            ["4", "Sample patterns overcome"],
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <p className="text-3xl font-bold">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>
        {tab === "Overview" && (
          <div className="grid gap-5 md:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-xs font-semibold text-primary">
                CURRENT SAMPLE TASK
              </p>
              <h2 className="mt-3 text-2xl font-bold">DEMO: Input practice</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Trace a boundary case, write a small check, then compare
                expected and actual output. This preview does not run code or
                call AI services.
              </p>
              <div className="mt-5 flex items-center justify-between text-sm font-semibold">
                <span>Sample journey progress</span>
                <span>50%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-primary/10">
                <div className="h-2 w-1/2 rounded-full bg-primary" />
              </div>
              <button
                onClick={() => setTab("Missions")}
                className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white"
              >
                Explore sample missions
              </button>
            </section>
            <section className="rounded-2xl border border-border bg-surface p-6">
              <h2 className="text-xl font-bold">Sample skill mastery</h2>
              <div className="mt-5 space-y-4">
                {plan.skills.map((skill) => (
                  <div key={skill.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{skill.name}</span>
                      <span>{skill.level}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-primary/10">
                      <div
                        style={{ width: `${skill.level}%` }}
                        className="h-2 rounded-full bg-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
        {tab === "Missions" && (
          <section className="grid gap-4 md:grid-cols-2">
            {plan.missions.map((mission, i) => (
              <article
                key={mission.id}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <p className="text-xs font-bold text-primary">
                  SAMPLE{" "}
                  {i < 3 ? "COMPLETED" : i === 3 ? "IN PROGRESS" : "UP NEXT"}
                </p>
                <h2 className="mt-2 text-lg font-bold">{mission.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {mission.description}
                </p>
                <ol className="mt-3 list-inside list-decimal text-sm">
                  {mission.steps.map((step) => (
                    <li key={step.title}>{step.title}</li>
                  ))}
                </ol>
              </article>
            ))}
          </section>
        )}
        {tab === "Sessions" && (
          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-xl font-bold">
              12 synthetic practice sessions
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sample history only. These sessions were not performed by a
              learner.
            </p>
            <div className="mt-5 divide-y divide-border">
              {sample.sessions.map((session, i) => (
                <article
                  key={i}
                  className="flex items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-semibold">{session.missionTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sample session {i + 1} - synthetic example
                    </p>
                  </div>
                  <span className="shrink-0 text-sm">
                    {session.minutes} min
                  </span>
                </article>
              ))}
            </div>
          </section>
        )}
        {tab === "Struggle DNA" && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
              <h2 className="text-xl font-bold">Sample Struggle DNA</h2>
              <p className="mt-2 text-sm">
                52 synthetic attempts, 18 sample failures, 4 sample recovery
                wins and 2 patterns being worked on. Not verified learner
                evidence or certification.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {patterns.map((pattern) => (
                <article
                  key={pattern.id}
                  className="rounded-2xl border border-border bg-surface p-5"
                >
                  <p className="text-xs font-bold text-primary">
                    {pattern.status === "conquered"
                      ? "SAMPLE RECOVERY WIN"
                      : "SAMPLE PATTERN IN PROGRESS"}
                  </p>
                  <h3 className="mt-2 font-semibold">{pattern.summary}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Illustrates the fail, diagnose, adapt and reassess loop. No
                    real learner is being assessed in this preview.
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
        <footer className="border-t border-border py-5 text-xs leading-5 text-muted-foreground">
          Public sample preview. No account access, cloud writes, paid AI,
          calendar changes or saved progress. Real accounts keep normal Google
          and password sign-in.{" "}
          <a href="/" className="font-semibold text-primary">
            Exit demo
          </a>
        </footer>
      </div>
    </main>
  );
}
