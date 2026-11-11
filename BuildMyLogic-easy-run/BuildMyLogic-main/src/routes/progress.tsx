import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Check, Code2, Flame, Layers, Lock, Target, Trophy, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { AppShell } from "@/components/AppShell";
import { useLoop } from "@/lib/loop-store";

export const Route = createFileRoute("/progress")({
  head: () => ({ meta: [{ title: "Progress — BuildMyLogic" }] }),
  component: Progress,
});

function dayKey(value: number) {
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function levelLabel(level: number) {
  if (level >= 70) return "Advanced";
  if (level >= 40) return "Intermediate";
  return "Developing";
}

function computeStreak(sessions: { at: number }[]) {
  const days = new Set(sessions.map((s) => new Date(s.at).toDateString()));
  const cursor = new Date();
  let count = 0;
  while (days.has(cursor.toDateString())) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

const COMPETENCY_AXES: { axis: string; keywords: string[] }[] = [
  { axis: "Problem Solving", keywords: ["problem", "logic", "algorithm"] },
  { axis: "Coding", keywords: ["python", "javascript", "typescript", "java", "c", "coding", "programming", "react", "html", "css"] },
  { axis: "Data Handling", keywords: ["data", "input", "output", "file", "pandas", "variable", "sql"] },
  { axis: "Project Building", keywords: ["project", "build", "deploy", "api", "app"] },
  { axis: "Concepts", keywords: ["concept", "function", "oop", "control", "loop", "condition", "array", "string"] },
  { axis: "Debugging", keywords: ["debug", "error", "test", "fix"] },
];

function Progress() {
  const state = useLoop();
  const [tab, setTab] = useState<"Overview" | "Skills" | "Missions" | "Activity">("Overview");
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const plan = state.plan;
  const missions = plan?.missions ?? [];
  const skills = plan?.skills ?? [];
  const completedMissions = missions.filter((m) => state.missionProgress[m.id]?.status === "done");
  const activeMission = missions.find((m) => state.missionProgress[m.id]?.status === "active") ?? missions[0];
  const nextMission = activeMission ? missions[missions.findIndex((m) => m.id === activeMission.id) + 1] : undefined;
  const averageSkill = skills.length ? Math.round(skills.reduce((sum, s) => sum + s.level, 0) / skills.length) : 0;
  const streakDays = computeStreak(state.sessions);
  const selected = missions.find((m) => m.id === selectedMission);
  const selectedSessions = selected ? state.sessions.filter((s) => s.missionTitle === selected.title).slice(0, 8) : [];

  const competency = useMemo(() => {
    const entries: [string, number][] = [
      ...skills.map((s): [string, number] => [s.name, s.level]),
      ...Object.entries(state.skillMemory ?? {}).map(([name, item]): [string, number] => [name, item.level]),
    ];
    return COMPETENCY_AXES.map(({ axis, keywords }) => {
      const matches = entries
        .filter(([name]) => keywords.some((k) => name.toLowerCase().includes(k)))
        .map(([, level]) => level);
      return { axis, value: matches.length ? Math.round(matches.reduce((a, b) => a + b, 0) / matches.length) : 0 };
    });
  }, [skills, state.skillMemory]);
  const hasCompetency = competency.some((c) => c.value > 0);

  const week = useMemo(() => {
    const activeDays = new Set(state.sessions.map((s) => dayKey(s.at)));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        active: activeDays.has(dayKey(d.getTime())),
        today: i === 6,
      };
    });
  }, [state.sessions]);

  const topSkill = skills.length ? [...skills].sort((a, b) => b.level - a.level)[0]! : null;
  const goals: [string, boolean][] = [
    ...(activeMission ? [[`Complete ${activeMission.title}`, state.missionProgress[activeMission.id]?.status === "done"] as [string, boolean]] : []),
    ...(nextMission ? [[`Build and submit the ${nextMission.title} project`, (state.missionProgress[nextMission.id]?.completedSteps?.length ?? 0) >= nextMission.steps.length && nextMission.steps.length > 0] as [string, boolean]] : []),
    ...(topSkill ? [[`Improve ${topSkill.name} mastery to ${Math.min(100, topSkill.level + 25)}%`, false] as [string, boolean]] : []),
  ];

  const achievements: { title: string; detail: string; earned: boolean; icon: typeof Trophy }[] = [
    { title: "First Session Logged", detail: "Logged your first real practice session", earned: state.sessions.length > 0, icon: Code2 },
    { title: "First Project Completed", detail: "Built and submitted a working project", earned: completedMissions.length > 0, icon: Trophy },
    { title: "5-Day Learning Streak", detail: "Stayed consistent for 5 days", earned: streakDays >= 5, icon: Flame },
  ];

  return (
    <AppShell
      crumb="My Progress"
      title="Your Learning Progress"
      subtitle="Track your skills, projects, and overall growth in one place."
      quote="Consistent practice turns learning into real skill."
      wide
    >
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1.5">
        {(["Overview", "Skills", "Missions", "Activity"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-xl px-4 py-2.5 text-[13px] font-bold transition ${tab === item ? "bg-primary-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <>
          {/* Stat cards */}
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Layers} value={completedMissions.length} label="Projects Completed" />
            <StatCard icon={Code2} value={state.sessions.length} label="Practice Sessions" />
            <StatCard icon={BarChart3} value={`${averageSkill}%`} label="Overall Mastery" />
            <StatCard icon={Flame} value={`${streakDays}-day streak`} label={streakDays > 0 ? "Keep it up!" : "Start today!"} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Skill Mastery */}
            <section className="card-surface p-5 sm:p-6 lg:col-span-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-extrabold">Skill Mastery</h2>
                <Link to="/skills" className="text-[12px] font-bold text-accent-foreground hover:underline">View Details →</Link>
              </div>
              <div className="mt-5 space-y-4">
                {skills.length === 0 ? (
                  <p className="text-[13px] font-semibold text-muted-foreground">Complete a mission to start measuring your skills.</p>
                ) : (
                  skills.slice(0, 6).map((skill) => (
                    <div key={skill.name} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Code2 className="h-4 w-4" />
                      </span>
                      <span className="w-28 truncate text-[13px] font-semibold">{skill.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, skill.level))}%` }} />
                      </div>
                      <span className="w-9 text-right text-[12px] font-bold">{skill.level}%</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Competency Overview */}
            <section className="card-surface p-5 sm:p-6 lg:col-span-5">
              <h2 className="text-[16px] font-extrabold">Competency Overview</h2>
              {hasCompetency ? (
                <div className="mt-2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={competency} outerRadius="72%">
                      <PolarGrid stroke="oklch(0.9 0.02 300)" />
                      <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10.5, fill: "oklch(0.35 0.02 275)", fontWeight: 600 }} />
                      <Radar dataKey="value" stroke="oklch(0.53 0.24 297)" fill="oklch(0.53 0.24 297)" fillOpacity={0.25} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-8 rounded-2xl bg-muted px-5 py-10 text-center">
                  <BarChart3 className="mx-auto h-7 w-7 text-muted-foreground" />
                  <p className="mx-auto mt-3 max-w-xs text-[13px] font-semibold text-muted-foreground">
                    Your competency map lights up as you finish lessons, checkpoints and build sessions.
                  </p>
                </div>
              )}
            </section>

            {/* Streak + Achievements */}
            <div className="space-y-5 lg:col-span-3">
              <section className="card-surface p-5">
                <div className="flex items-center gap-2.5">
                  <Flame className="h-[18px] w-[18px] text-primary" />
                  <h3 className="text-[15px] font-extrabold">Learning Streak</h3>
                </div>
                <p className="display mt-3 text-[22px] font-black">{streakDays} day{streakDays === 1 ? "" : "s"}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {streakDays > 0 ? `You've learned for ${streakDays} consecutive day${streakDays === 1 ? "" : "s"}!` : "Log a session today to start your streak."}
                </p>
                <div className="mt-4 flex justify-between">
                  {week.map((day) => (
                    <div key={day.label} className="flex flex-col items-center gap-1.5">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${day.active ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                        {day.active && <Check className="h-3 w-3" strokeWidth={3.2} />}
                      </span>
                      <span className="text-[10px] font-semibold text-muted-foreground">{day.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card-surface p-5">
                <h3 className="text-[15px] font-extrabold">Achievements</h3>
                <div className="mt-3 space-y-3">
                  {achievements.map((a) => (
                    <div key={a.title} className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${a.earned ? "border-border bg-card" : "border-dashed border-border opacity-60"}`}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        <a.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold">{a.title}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{a.detail}</p>
                      </div>
                      {a.earned ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" strokeWidth={3.2} /></span>
                      ) : (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Recent Projects */}
            <section className="card-surface p-5 sm:p-6 lg:col-span-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Layers className="h-[18px] w-[18px] text-primary" />
                  <h2 className="text-[16px] font-extrabold">Recent Projects</h2>
                </div>
                <Link to="/missions" className="text-[12px] font-bold text-accent-foreground hover:underline">View All Projects →</Link>
              </div>
              <div className="mt-4 space-y-3">
                {missions.length === 0 ? (
                  <p className="text-[13px] font-semibold text-muted-foreground">Finish onboarding and your projects will appear here.</p>
                ) : (
                  missions.slice(0, 4).map((mission) => {
                    const status = state.missionProgress[mission.id]?.status ?? "locked";
                    return (
                      <div key={mission.id} className="flex items-center gap-3.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                          <Code2 className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-bold">{mission.title}</p>
                          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{mission.description}</p>
                        </div>
                        {status === "done" ? (
                          <span className="pill shrink-0 bg-emerald-100 font-bold text-emerald-700"><Check className="h-3 w-3" strokeWidth={3} /> Completed</span>
                        ) : status === "active" ? (
                          <span className="pill shrink-0 bg-primary-soft font-bold text-accent-foreground">In Progress</span>
                        ) : (
                          <span className="pill shrink-0 bg-muted font-bold text-muted-foreground">Planned</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Next Goals */}
            <section className="card-surface p-5 sm:p-6 lg:col-span-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Target className="h-[18px] w-[18px] text-primary" />
                  <h2 className="text-[16px] font-extrabold">Next Goals</h2>
                </div>
                <Link to="/settings" className="text-[12px] font-bold text-accent-foreground hover:underline">Set Goals →</Link>
              </div>
              <div className="mt-4 space-y-3">
                {goals.length === 0 ? (
                  <p className="text-[13px] font-semibold text-muted-foreground">Finish onboarding and your goals will appear here.</p>
                ) : (
                  goals.map(([label, done]) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {done && <Check className="h-3 w-3" strokeWidth={3.2} />}
                      </span>
                      <p className={`text-[13.5px] ${done ? "font-bold" : "font-medium text-muted-foreground"}`}>{label}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {tab === "Skills" && <section className="card-surface mt-5 p-6"><h2 className="text-xl font-extrabold">Skills you’re building</h2><div className="mt-6 grid gap-4 md:grid-cols-2">{skills.map((skill) => <div key={skill.name} className="rounded-2xl border border-black/10 p-5"><div className="flex justify-between"><p className="font-extrabold">{skill.name}</p><span className="font-extrabold">{skill.level}%</span></div><div className="mt-4 h-2.5 rounded-full bg-black/10"><div className="h-full rounded-full bg-primary" style={{ width: `${skill.level}%` }} /></div><p className="mt-3 text-sm font-semibold">{skill.note || levelLabel(skill.level)}</p></div>)}</div>{skills.length === 0 && <p className="mt-4 text-sm font-bold">Complete a mission to start measuring your skills.</p>}</section>}

      {tab === "Missions" && <section className="card-surface mt-5 p-6"><h2 className="text-xl font-extrabold">Mission Evidence</h2><div className="mt-5 space-y-3">{missions.map((mission) => { const p = state.missionProgress[mission.id] ?? { status: "locked", completedSteps: [] }; const missionSessions = state.sessions.filter((s) => s.missionTitle === mission.title); return <button type="button" key={mission.id} onClick={() => setSelectedMission(mission.id)} className="flex w-full items-center gap-4 rounded-2xl border border-black/10 p-4 text-left hover:border-primary/40"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">{p.status === "done" ? <Check className="h-5 w-5" /> : p.status === "active" ? <Flame className="h-5 w-5" /> : <Lock className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><b className="block text-sm">{mission.title}</b><span className="mt-1 block text-xs font-semibold">{p.completedSteps?.length ?? 0}/{mission.steps.length} learning steps · {missionSessions.length} sessions logged</span></span><span className="text-xs font-extrabold">{mission.minutes}m</span></button>; })}</div>{selected && <MissionHistory mission={selected} sessions={selectedSessions} onClose={() => setSelectedMission(null)} />}</section>}

      {tab === "Activity" && <section className="card-surface mt-5 p-6"><h2 className="text-xl font-extrabold">Build Activity</h2><div className="mt-5 divide-y divide-black/10">{state.activity.length === 0 ? <p className="py-5 text-sm font-bold">No activity yet.</p> : state.activity.map((item) => <div key={item.at} className="flex gap-4 py-4"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" /><div><p className="text-sm font-extrabold">{item.text}</p><p className="mt-1 text-xs font-semibold">{new Date(item.at).toLocaleString()}</p></div></div>)}</div></section>}
    </AppShell>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: typeof Layers; value: string | number; label: string }) {
  return (
    <section className="card-surface flex items-center gap-3.5 p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="display truncate text-[22px] font-black leading-tight">{value}</p>
        <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">{label}</p>
      </div>
    </section>
  );
}

function MissionHistory({ mission, sessions, onClose }: { mission: NonNullable<ReturnType<typeof useLoop>["plan"]>["missions"][number]; sessions: ReturnType<typeof useLoop>["sessions"]; onClose: () => void }) {
  return <div className="mt-5 rounded-2xl border-2 border-primary/20 bg-primary-soft/40 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-wider text-primary">Mission history</p><h3 className="mt-1 text-lg font-black">{mission.title}</h3><p className="mt-1 text-sm font-semibold">{sessions.length} session{sessions.length === 1 ? "" : "s"} logged for this mission.</p></div><button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white" aria-label="Close history"><X className="h-4 w-4" /></button></div><div className="mt-4 space-y-3">{sessions.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm font-bold">No session history yet. Start building this mission and your work will appear here.</p> : sessions.map((session) => <div key={session.at} className="rounded-xl border border-black/10 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black">{new Date(session.at).toLocaleString()}</p><span className="text-xs font-black">{session.minutes} min</span></div><p className="mt-2 text-sm font-semibold">{session.note || "No session note was added."}</p>{session.completedTasks?.length ? <p className="mt-2 text-xs font-bold">{session.completedTasks.length}/{session.tasks?.length ?? 0} session tasks completed.</p> : null}{session.review ? <p className="mt-2 text-xs font-bold">BuildMyLogic Mentor: {session.review.feedback}</p> : null}</div>)}</div></div>;
}
