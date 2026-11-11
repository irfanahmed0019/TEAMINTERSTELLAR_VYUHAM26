import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronDown, Clock3, Code2, FolderOpen, Lightbulb, Pause, Play, RotateCcw, ShieldCheck, Sparkles, Timer, Upload, X, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { applyBuildSessionEvidence, applySarvamDashboardPlan, getLoopState, logActivity, recordMissionEvidence, setLoopState, useLoop } from "@/lib/loop-store";
import type { BuildSessionState, SessionReview } from "@/lib/loop-types";
import { aiRetunePlan, aiReviewProjectZip, aiReviewSession } from "@/lib/sarvam.functions";
import { getAuthSessionForApi } from "@/lib/auth";
import type { ProjectReview } from "@/lib/project-review";

export const Route = createFileRoute("/sessions")({ head: () => ({ meta: [{ title: "Sessions — BuildMyLogic" }] }), component: Sessions });
const BRIDGE_URL = "http://127.0.0.1:8091";
type RemoteSessionState = BuildSessionState & { extension_status: string; checkpoints?: RemoteCheckpoint[] };
type RemoteCheckpoint = { index: number; title: string; detail: string; status: "locked" | "active" | "passed" | "failed"; evidence?: "not_verified" | "detected" | "verified"; attempts: number; lastOutput?: string };

function difficultyLabel(difficulty: number) {
  if (difficulty <= 1) return "Beginner";
  if (difficulty === 2) return "Intermediate";
  return "Advanced";
}

function Sessions() {
  const state = useLoop();
  const navigate = useNavigate();
  const plan = state.plan;
  const sessionPlan = plan?.session;
  const planned = sessionPlan?.totalMinutes ?? 45;
  const missions = plan?.missions ?? [];
  const activeMission = missions.find((m) => state.missionProgress[m.id]?.status !== "done") ?? missions[0];
  const nextMission = activeMission ? missions[missions.findIndex((m) => m.id === activeMission.id) + 1] : undefined;
  const storedStartedAt = typeof window !== "undefined" ? Number(window.localStorage.getItem("loop-session-started-at") || 0) : 0;
  const storedDuration = typeof window !== "undefined" ? Number(window.localStorage.getItem("loop-session-duration") || 0) : 0;
  const initialRemaining = storedStartedAt && storedDuration ? Math.max(0, storedDuration - Math.floor((Date.now() - storedStartedAt) / 1000)) : planned * 60;
  const [seconds, setSeconds] = useState(initialRemaining);
  const [running, setRunning] = useState(Boolean(storedStartedAt && initialRemaining > 0));
  const [done, setDone] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState<SessionReview | null>(null);
  const [projectReview, setProjectReview] = useState<ProjectReview | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipName, setZipName] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<number | null>(null);
  const [workspacePath, setWorkspacePath] = useState("");
  const [projectFolder, setProjectFolder] = useState("");
  const [projectFileCount, setProjectFileCount] = useState(0);
  const [pickingProject, setPickingProject] = useState(false);
  const [vscodeSession, setVscodeSession] = useState<{ sessionId: string; status?: string } | null>(null);
  const [remoteState, setRemoteState] = useState<RemoteSessionState | null>(null);
  const [pickerError, setPickerError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const startRef = useRef(planned * 60);
  const retuneKeyRef = useRef("");

  useEffect(() => {
    const saved = window.localStorage.getItem("loop-vscode-path") ?? "";
    const savedProject = window.localStorage.getItem("loop-project-folder") ?? "";
    const savedSession = window.localStorage.getItem("bml-vscode-session");
    setWorkspacePath(saved);
    setProjectFolder(savedProject);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession) as { sessionId?: string; status?: string };
        if (parsed.sessionId && /^BML-[A-Z0-9]{5}$/i.test(parsed.sessionId)) setVscodeSession({ sessionId: parsed.sessionId, status: "waiting" });
        else window.localStorage.removeItem("bml-vscode-session");
      } catch { window.localStorage.removeItem("bml-vscode-session"); }
    }
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem("loop-session-started-at")) return;
    startRef.current = planned * 60;
    setSeconds(planned * 60);
  }, [planned]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setSeconds((value) => { if (value <= 1) { setRunning(false); window.localStorage.removeItem("loop-session-started-at"); window.localStorage.removeItem("loop-session-duration"); return 0; } return value - 1; }), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (window.localStorage.getItem("loop-auto-start-session") !== "1") return;
    window.localStorage.removeItem("loop-auto-start-session");
    // Use the same flow as the visible Start Session button. This means a
    // mission launched from another page also selects a folder, creates the
    // shared session, and opens the extension in that workspace.
    window.setTimeout(() => { void startSession(); }, 0);
  }, []);

  useEffect(() => {
    if (!vscodeSession) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(vscodeSession.sessionId)}/state`, { cache: "no-store" });
        const result = await response.json() as { ok?: boolean; state?: RemoteSessionState };
        if (!cancelled && result.ok && result.state) {
          setRemoteState(result.state);
          setVscodeSession((current) => {
            if (!current) return current;
            const status = result.state?.extension_status ?? result.state?.status;
            return status ? { ...current, status } : current;
          });
        } else if (!cancelled && (response.status === 401 || response.status === 404)) {
          setVscodeSession(null);
          setRemoteState(null);
          window.localStorage.removeItem("bml-vscode-session");
          setPickerError("That VS Code session expired after the server restarted. Start a new session to generate a fresh Session ID.");
        }
      } catch { /* Retain the last confirmed state while offline. */ }
    };
    void sync(); const id = window.setInterval(() => void sync(), 5000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [vscodeSession?.sessionId]);

  useEffect(() => {
    if (!remoteState || !activeMission) return;
    const completed = remoteState.status === "completed";
    const shouldRetune = completed || remoteState.status === "failed" || Boolean(remoteState.potential_struggle);
    if (!shouldRetune) return;
    applyBuildSessionEvidence(remoteState);
    const retuneKey = `${remoteState.session_id}:${remoteState.status}:${remoteState.attempts}:${remoteState.test_score?.passed ?? 0}:${remoteState.potential_struggle ? "struggle" : "normal"}`;
    if (retuneKeyRef.current === retuneKey) return;
    retuneKeyRef.current = retuneKey;
    const current = getLoopState();
    if (!current.profile || !current.plan) return;
    void aiRetunePlan({ data: { profile: current.profile, plan: current.plan, activity: current.activity } }).then((suggested) => {
      applySarvamDashboardPlan(suggested);
      logActivity({ kind: "ai", text: completed ? "BuildMyLogic Mentor retuned your path after a proven challenge." : "BuildMyLogic Mentor retuned your path around the weak point." });
    }).catch(() => {
      // Deterministic recovery/practice changes remain active when AI provider is unavailable.
    });
  }, [activeMission, remoteState]);

  const elapsed = Math.max(1, Math.round((startRef.current - seconds) / 60));
  const pct = startRef.current ? Math.min(100, ((startRef.current - seconds) / startRef.current) * 100) : 0;
  const total = state.sessions.reduce((sum, item) => sum + item.minutes, 0);
  const currentTasks = sessionPlan?.tasks ?? [{ title: "Read the mission brief", minutes: 5 }, { title: "Implement the next piece", minutes: 25 }, { title: "Run and verify your work", minutes: 10 }, { title: "Write down what changed", minutes: 5 }];
  const extensionStatus = remoteState?.extension_status ?? vscodeSession?.status ?? "waiting";
  const extensionConnected = extensionStatus === "active" || extensionStatus === "connected";
  const sessionLabel = extensionStatus === "completed" ? "Challenge completed" : extensionStatus === "failed" ? "Recovery mode" : extensionStatus === "disconnected" ? "VS Code disconnected" : extensionConnected ? "VS Code connected" : "Waiting for VS Code";
  const remoteCheckpoints = (remoteState?.checkpoints ?? []) as RemoteCheckpoint[];
  const verifiedCount = remoteCheckpoints.length
    ? remoteCheckpoints.filter((task) => (task.evidence ?? (task.status === "passed" ? "verified" : "not_verified")) === "verified").length
    : done.length;
  const tasksTotal = remoteCheckpoints.length || currentTasks.length;
  const testsLabel = remoteState?.test_score ? `${remoteState.test_score.passed} / ${remoteState.test_score.total}` : `${verifiedCount} / ${tasksTotal}`;
  const attemptsLabel = remoteState ? remoteState.attempts : Math.max(1, state.sessions.length + 1);
  const activeStepsDone = activeMission ? (state.missionProgress[activeMission.id]?.completedSteps?.length ?? 0) : 0;
  const activeStepsTotal = activeMission?.steps.length ?? 1;
  const missionPct = activeMission ? Math.min(100, Math.round((activeStepsDone / activeStepsTotal) * 100)) : 0;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayMinutes = state.sessions.filter((s) => s.at >= todayStart.getTime()).reduce((sum, s) => sum + s.minutes, 0) + (running || seconds < startRef.current ? elapsed : 0);

  async function createVscodeSession() {
    if (!activeMission) throw new Error("No active mission is selected.");
    const auth = await getAuthSessionForApi();
    const userId = auth?.uid || "local-user";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth?.idToken) headers["Authorization"] = `Bearer ${auth.idToken}`;
    const response = await fetch("/api/sessions/start", {
      method: "POST",
      headers,
      body: JSON.stringify({ challenge_id: activeMission.id, user_id: userId, title: activeMission.title, language: activeMission.stack, concept: activeMission.skills[0] ?? "problem solving", instructions: activeMission.description + "\n\nRequirements:\n" + activeMission.steps.map((step, index) => `Step ${index + 1}: ${step.title} — ${step.detail}`).join("\n"), checkpoints: activeMission.steps.map((step, index) => ({ index, title: step.title, detail: step.detail })), expected_skills: activeMission.skills, test_command: activeMission.id === "cli-calculator" ? "gcc -std=c11 -Wall -Wextra -o /tmp/buildmylogic-cli-calculator main.c" : undefined }),
    });
    const result = (await response.json()) as { ok?: boolean; session_id?: string; state?: RemoteSessionState; error?: string };
    if (!response.ok || !result.ok || !result.session_id) throw new Error(result.error || "Could not create the BuildMyLogic VS Code session.");
    const session = { sessionId: result.session_id, status: "waiting" };
    setVscodeSession(session);
    setRemoteState(result.state ?? null);
    window.localStorage.setItem("bml-vscode-session", JSON.stringify(session));
    return { ...session, userId };
  }

  async function connectExtension(session: { sessionId: string }) {
    const uri = `vscode://buildmylogic.buildmylogic/connect?sessionId=${encodeURIComponent(session.sessionId)}&apiBaseUrl=${encodeURIComponent(window.location.origin)}`;
    const anchor = document.createElement("a");
    anchor.href = uri;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function openVsCode(session?: { sessionId: string }, selectedPath?: string) {
    // A project folder is optional: the extension can connect without one.
    const path = (selectedPath ?? workspacePath).trim();
    try {
      const response = await fetch(`${BRIDGE_URL}/${session ? "open-vscode-session" : "open-vscode"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session ? { path, session_id: session.sessionId, api_base_url: window.location.origin } : { path }),
        signal: AbortSignal.timeout(1200),
      }).catch(() => null);

      if (response && response.ok) {
        // The desktop bridge opens the selected folder and forwards the URI.
        // Send the URI from the browser too so the extension dashboard opens
        // and connects even when the second `code` process is delayed.
        if (session) await connectExtension(session);
        return;
      }
      // Fallback: connect the extension through the URI handler directly.
      if (session) { await connectExtension(session); return; }
      if (path) {
        const formattedPath = path.startsWith("/") ? path : `/${path}`;
        const anchor = document.createElement("a");
        anchor.href = `vscode://file${encodeURI(formattedPath)}`;
        anchor.click();
      }
    } catch {
      if (session) { await connectExtension(session); return; }
      if (path) {
        const formattedPath = path.startsWith("/") ? path : `/${path}`;
        const anchor = document.createElement("a");
        anchor.href = `vscode://file${encodeURI(formattedPath)}`;
        anchor.click();
      }
    }
  }

  async function pickProjectFolder(forOpening = false) {
    setPickingProject(true);
    setPickerError("");
    try {
      // 1. Try desktop bridge helper if available
      try {
        const health = await fetch(`${BRIDGE_URL}/health`, {
          cache: "no-store",
          signal: AbortSignal.timeout(800),
        }).catch(() => null);

        if (health && health.ok) {
          const response = await fetch(`${BRIDGE_URL}/pick-folder`, { method: "POST" });
          const result = (await response.json()) as { ok?: boolean; path?: string; error?: string };
          if (response.ok && result.ok && result.path) {
            const path = result.path.trim().replace(/[\\/]+$/, "");
            const folder = path.split(/[\\/]/).filter(Boolean).pop() || path;
            setWorkspacePath(path);
            setProjectFolder(folder);
            setProjectFileCount(0);
            window.localStorage.setItem("loop-vscode-path", path);
            window.localStorage.setItem("loop-project-folder", folder);
            return path;
          }
        }
      } catch {
        // Desktop bridge unavailable; proceed to browser folder picker
      }

      // A browser can upload directory contents, but it cannot reveal the
      // absolute local path needed by VS Code. Still let the learner pick the
      // folder here (the name is saved and the session works); only the
      // direct "open this folder in VS Code" step needs the local bridge.
      // Chrome's Local Network Access prompt makes the health probe above
      // time out while it is pending, so call that case out explicitly
      // instead of silently falling back.
      setPickerError("Could not reach the BuildMyLogic desktop bridge. If Chrome asked to access devices on your local network, choose Allow there and pick the folder again. Otherwise install or update the BuildMyLogic VS Code extension (v0.0.8 or newer) and keep VS Code open, then pick the folder again. You can still pick the folder below without the bridge - your session will work, but VS Code cannot open it directly.");

      // 2. Browser native file/directory picker fallback
      folderInputRef.current?.click();
      return "";
    } catch {
      folderInputRef.current?.click();
      return "";
    } finally {
      setPickingProject(false);
    }
  }

  function restartSession() {
    const duration = planned * 60;
    startRef.current = duration;
    setSeconds(duration);
    setRunning(false);
    window.localStorage.removeItem("loop-session-started-at");
    window.localStorage.removeItem("loop-session-duration");
  }

  function selectProjectFolder(files: FileList | null) {
    if (!files?.length) return;
    const first = files[0];
    if (!first) return;
    const relative = (first as File & { webkitRelativePath?: string }).webkitRelativePath ?? first.name;
    const folder = relative.split("/")[0] || first.name;
    setProjectFolder(folder);
    setProjectFileCount(files.length);
    window.localStorage.setItem("loop-project-folder", folder);
  }

  async function startSession(forceNew = false) {
    if (running && !forceNew) {
      setRunning(false);
      window.localStorage.removeItem("loop-session-started-at");
      window.localStorage.removeItem("loop-session-duration");
      return;
    }
    try {
      const duration = forceNew ? startRef.current : seconds;
      if (forceNew) {
        setVscodeSession(null);
        setRemoteState(null);
        window.localStorage.removeItem("bml-vscode-session");
      }
      const startedAt = Date.now();
      if (forceNew) setSeconds(duration);
      window.localStorage.setItem("loop-session-started-at", String(startedAt));
      window.localStorage.setItem("loop-session-duration", String(duration));
      setRunning(true);
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : "Could not start the BuildMyLogic session.");
      setRunning(false);
    }
  }

  async function openAndConnectVsCode() {
    try {
      // The folder picker is optional: never block session creation on it.
      const selectedPath = workspacePath.trim() || window.localStorage.getItem("loop-vscode-path")?.trim() || "";
      const hasFreshSession = Boolean(vscodeSession?.sessionId && /^BML-[A-Z0-9]{5}$/i.test(vscodeSession.sessionId));
      const connected = hasFreshSession && vscodeSession ? vscodeSession : await createVscodeSession();
      await openVsCode(connected, selectedPath);
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : "Could not connect VS Code.");
    }
  }

  function disconnectVsCode() {
    setVscodeSession(null);
    setRemoteState(null);
    window.localStorage.removeItem("bml-vscode-session");
  }

  async function copySessionId() {
    if (!vscodeSession) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(vscodeSession.sessionId);
      } else {
        const input = document.createElement("textarea");
        input.value = vscodeSession.sessionId;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      setCopyNotice("Session ID copied. Paste it into the BuildMyLogic extension in VS Code.");
    } catch {
      setCopyNotice("Copy failed. Select the Session ID and copy it manually.");
    }
  }

  async function finish() {
    if (saving || !activeMission) return;
    setSaving(true);
    setRunning(false);
    try {
      const result = await aiReviewSession({ data: { missionTitle: activeMission.title, note, minutes: elapsed } });
      setReview(result);
      setLoopState((prev) => ({ ...prev, sessions: [{ at: Date.now(), minutes: elapsed, missionTitle: activeMission.title, note, tasks: currentTasks, completedTasks: done, review: result }, ...prev.sessions].slice(0, 40) }));
      logActivity({ kind: "session", text: `Logged a ${elapsed} min session on ${activeMission.title}` });
      recordMissionEvidence(activeMission.id, 2);
      if (done.length) {
        setLoopState((prev) => ({ ...prev, missionProgress: { ...prev.missionProgress, [activeMission.id]: { ...(prev.missionProgress[activeMission.id] ?? { status: "active", completedSteps: [] }), completedSteps: Array.from(new Set([...(prev.missionProgress[activeMission.id]?.completedSteps ?? []), ...done])) } } }));
      }
      setNote("");
      window.localStorage.removeItem("loop-session-started-at");
      window.localStorage.removeItem("loop-session-duration");
    } catch (error) {
      setReview({ feedback: error instanceof Error ? error.message : "Could not review this session.", nextStep: "Try logging the session again.", skillBoost: "—" });
    } finally {
      setSaving(false);
    }
  }

  function completeMission() {
    if (!activeMission) return;
    const index = missions.findIndex((m) => m.id === activeMission.id);
    const next = missions[index + 1];
    window.localStorage.removeItem("loop-session-started-at");
    window.localStorage.removeItem("loop-session-duration");
    setLoopState((prev) => ({
      ...prev,
      missionProgress: {
        ...prev.missionProgress,
        [activeMission.id]: { ...(prev.missionProgress[activeMission.id] ?? { status: "active", completedSteps: [] }), status: "done", completedSteps: Array.from({ length: activeMission.steps.length }, (_, i) => i) },
        ...(next ? { [next.id]: { ...(prev.missionProgress[next.id] ?? { status: "locked", completedSteps: [] }), status: "active" } } : {}),
      },
    }));
    recordMissionEvidence(activeMission.id, 5);
    logActivity({ kind: "mission", text: `Completed mission “${activeMission.title}”` });
  }

  async function reviewZip(file: File | undefined) {
    if (!file || zipBusy) return;
    if (!file.name.toLowerCase().endsWith(".zip")) { setReview({ feedback: "Please choose a .zip project archive.", nextStep: "Zip the completed project source and upload it again.", skillBoost: "Project hygiene" }); return; }
    if (file.size > 8 * 1024 * 1024) { setReview({ feedback: "That ZIP is over the 8 MB upload limit.", nextStep: "Remove node_modules, dist and build folders, then upload the source ZIP.", skillBoost: "Project hygiene" }); return; }
    setZipBusy(true); setZipName(file.name);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const result = await aiReviewProjectZip({ data: activeMission?.title ? { fileName: file.name, dataBase64: btoa(binary), missionTitle: activeMission.title } : { fileName: file.name, dataBase64: btoa(binary) } });
      setProjectReview(result);
      logActivity({ kind: "ai", text: `AI reviewed ${file.name}` });
    } catch (error) {
      setReview({ feedback: error instanceof Error ? error.message : "Could not review the project ZIP.", nextStep: "Check the archive and try again.", skillBoost: "—" });
    } finally { setZipBusy(false); }
  }

  return <AppShell crumb="Sessions" title="Your Learning Sessions" subtitle="Code, build and improve with real projects." quote="Turn your learning into real work." wide>
    {/* VS Code Integration banner */}
    <section className="card-surface flex flex-wrap items-center gap-4 p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Code2 className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[16px] font-extrabold">VS Code Integration</h2>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${extensionConnected ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${extensionConnected ? "bg-emerald-500" : "bg-red-500"}`} />
            {extensionConnected ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {extensionConnected
            ? "BuildMyLogic extension is running and tracking your progress."
            : vscodeSession
              ? `${sessionLabel}. Open VS Code and paste the Session ID into the extension.`
              : "Connect the BuildMyLogic extension to track your real work."}
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => { void openAndConnectVsCode(); }} disabled={pickingProject} className="btn-base btn-outline rounded-full disabled:cursor-wait disabled:opacity-60">
          <Code2 className="h-4 w-4" /> Open VS Code
        </button>
        {vscodeSession ? (
          <button type="button" onClick={disconnectVsCode} className="rounded-full px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:bg-muted">
            Disconnect
          </button>
        ) : (
          <a href="/extension.html" className="rounded-full px-3 py-2 text-[13px] font-semibold text-accent-foreground hover:bg-muted">
            Install extension →
          </a>
        )}
      </div>
    </section>

    {remoteState?.project_review && <SessionProjectReview review={remoteState.project_review} />}

    {/* Current Session + Your Progress */}
    <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
      <section className="card-surface p-6 sm:p-7 lg:col-span-7">
        <div className="flex h-full flex-col justify-between gap-6 sm:flex-row">
          <div className="min-w-0">
            <span className="pill bg-primary-soft text-accent-foreground">Current Session</span>
            <h2 className="display mt-4 text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{activeMission?.title ?? "Your build"}</h2>
            <p className="mt-2 max-w-md text-[13.5px] leading-6 text-muted-foreground">{activeMission?.description ?? "Build something useful and prove what you learned."}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><Timer className="h-4 w-4 text-primary" />Level {difficultyLabel(activeMission?.difficulty ?? 1)}</span>
              <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" />{(activeMission?.skills ?? []).join(" · ") || "Skills"}</span>
              <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-primary" />Est. Time ~{activeMission?.minutes ?? planned} min</span>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={() => { void startSession(); }} disabled={!activeMission} className="btn-base btn-primary-solid">
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {running ? "Pause Session" : seconds < startRef.current ? "Continue Session" : "Start Session"}
              </button>
              <a href="#session-tasks" className="btn-base btn-outline">
                View Tasks
              </a>
              {(running || seconds < startRef.current) && (
                <button type="button" onClick={restartSession} className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold text-muted-foreground hover:bg-muted">
                  <RotateCcw className="h-3.5 w-3.5" /> Restart
                </button>
              )}
            </div>
            {(running || seconds < startRef.current) && (
              <p className="mt-3 text-[12px] font-semibold text-muted-foreground">
                {running ? "● Live now" : "Ⅱ Paused"} · {elapsed} min elapsed · {Math.max(0, Math.ceil(seconds / 60))} min remaining
              </p>
            )}
          </div>
          <div className="relative hidden h-32 w-40 shrink-0 items-center justify-center sm:flex">
            <div className="absolute inset-0 rounded-full bg-primary-soft" />
            <div className="relative flex h-20 w-28 items-center justify-center rounded-2xl border border-primary/20 bg-card shadow-sm">
              <Code2 className="h-8 w-8 text-primary" />
            </div>
          </div>
        </div>
      </section>

      <section className="card-surface p-6 lg:col-span-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-extrabold">Your Progress</h3>
          <span className="text-[13px] font-bold">{missionPct}% Complete</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${missionPct}%` }} />
        </div>
        <div className="mt-4 space-y-1.5">
          {(activeMission?.steps ?? []).map((step, index) => {
            const isDone = activeMission ? (state.missionProgress[activeMission.id]?.completedSteps?.includes(index) ?? false) : false;
            const isCurrent = !isDone && index === activeStepsDone;
            return (
              <div key={step.title} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isCurrent ? "bg-primary-soft" : ""}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isDone ? "bg-emerald-500 text-white" : isCurrent ? "border-2 border-primary bg-card" : "border-2 border-border"}`}>
                  {isDone && <Check className="h-3 w-3" strokeWidth={3.2} />}
                </span>
                <p className={`text-[13px] ${isDone ? "font-semibold" : isCurrent ? "font-semibold" : "text-muted-foreground"}`}>
                  {step.title} {isCurrent && <span className="font-bold text-accent-foreground">(Current)</span>}
                </p>
              </div>
            );
          })}
          {!activeMission && <p className="text-[13px] font-semibold text-muted-foreground">Finish onboarding to unlock your session plan.</p>}
        </div>
      </section>
    </div>

    {/* Stat tiles */}
    <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <section className="card-surface p-5">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground"><Code2 className="h-4 w-4 text-primary" />Tests / Tasks Passed</div>
        <p className="display mt-2 text-[24px] font-black">{testsLabel}</p>
      </section>
      <section className="card-surface p-5">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground"><RotateCcw className="h-4 w-4 text-primary" />Attempts</div>
        <p className="display mt-2 text-[24px] font-black">{attemptsLabel}</p>
      </section>
      <section className="card-surface p-5">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground"><FolderOpen className="h-4 w-4 text-primary" />Project Folder</div>
        <p className="mt-2 break-all text-[13px] font-bold leading-5">{workspacePath || projectFolder || "No folder selected"}</p>
        <button type="button" onClick={() => { void pickProjectFolder(true); }} disabled={pickingProject} className="btn-base btn-outline mt-2.5 w-full py-1.5 text-[11.5px] disabled:cursor-wait disabled:opacity-60">
          <FolderOpen className="h-3.5 w-3.5" />{pickingProject ? "Selecting…" : workspacePath || projectFolder ? "Change Folder" : "Select Folder"}
        </button>
        {pickerError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">{pickerError}</p>}
      </section>
      <section className="card-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Session ID</div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${extensionConnected ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${extensionConnected ? "bg-emerald-500" : "bg-red-500"}`} />
            {extensionConnected ? "Connected" : "Not connected"}
          </span>
        </div>
        {vscodeSession ? (
          <>
            <button type="button" title="Click to copy session ID" aria-label="Copy session ID" onClick={() => { void copySessionId(); }} className="mt-2.5 flex w-full items-center justify-center rounded-xl bg-ink px-3 py-2.5 text-center text-lg font-black tracking-[0.08em] text-ink-foreground transition hover:opacity-85">
              {vscodeSession.sessionId}
            </button>
            <p className="mt-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Click the ID to copy</p>
            {copyNotice && <p className="mt-1.5 text-center text-[10px] font-bold text-emerald-700">{copyNotice}</p>}
          </>
        ) : (
          <p className="mt-2.5 rounded-xl bg-muted px-3 py-3.5 text-center text-[12px] font-semibold text-muted-foreground">Open VS Code to generate an ID.</p>
        )}
      </section>
    </div>

    {/* Session Activity + Next in Your Path */}
    <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
      <section className="card-surface p-5 sm:p-6 lg:col-span-7">
        <div className="flex items-center gap-2.5">
          <Clock3 className="h-[18px] w-[18px] text-primary" />
          <h2 className="text-[16px] font-extrabold">Session Activity</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-muted/70 p-4 text-center">
            <Code2 className="mx-auto h-5 w-5 text-primary" />
            <p className="display mt-2 text-[20px] font-black">{todayMinutes} min</p>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Coding Time</p>
          </div>
          <div className="rounded-2xl bg-muted/70 p-4 text-center">
            <Timer className="mx-auto h-5 w-5 text-primary" />
            <p className="display mt-2 text-[20px] font-black">{state.sessions.length}</p>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Sessions Logged</p>
          </div>
          <div className="rounded-2xl bg-muted/70 p-4 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />
            <p className="display mt-2 text-[20px] font-black">{verifiedCount} / {tasksTotal}</p>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Tasks Verified</p>
          </div>
          <div className="rounded-2xl bg-muted/70 p-4 text-center">
            <CheckCircle2 className={`mx-auto h-5 w-5 ${extensionConnected ? "text-emerald-600" : "text-muted-foreground"}`} />
            <p className="display mt-2 text-[20px] font-black">{extensionConnected ? "Synced" : "Local"}</p>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Evidence</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary-soft/60 p-5 sm:p-6 lg:col-span-5">
        <div className="flex items-center gap-2.5">
          <Lightbulb className="h-[18px] w-[18px] text-primary" />
          <h2 className="text-[16px] font-extrabold">Next in Your Path</h2>
        </div>
        {nextMission ? (
          <>
            <div className="mt-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary"><Code2 className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold">{nextMission.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">{nextMission.description}</p>
              </div>
            </div>
            <button type="button" onClick={() => void navigate({ to: "/learn" })} className="btn-base btn-outline mt-4 rounded-full bg-card">
              View Next Task <ArrowRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <p className="mt-4 text-[13px] font-semibold text-muted-foreground">
            {activeMission ? "This is the last mission on your path. Finish it to complete the path." : "Finish onboarding to unlock your path."}
          </p>
        )}
      </section>
    </div>

    <div className="mt-5 space-y-5">
      <SessionTasks remote={remoteCheckpoints} fallback={currentTasks} done={done} onToggle={(index) => setDone((prev) => prev.includes(index) ? prev.filter((x) => x !== index) : [...prev, index])} />

      <section className="card-surface p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Upcoming Sessions</h2><span className="text-xs font-black">View All →</span></div><div className="mt-3 divide-y divide-black/10">{missions.slice(1, 3).map((mission) => <div key={mission.id} className="flex items-center gap-4 py-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink text-ink-foreground"><Timer className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="text-sm font-black">{mission.title}</p><p className="mt-1 text-xs font-semibold">{mission.stack} · Difficulty {mission.difficulty} · Tomorrow, {state.profile?.startTime ?? "19:00"}</p><p className="mt-1 text-xs font-semibold">{mission.description}</p></div><button type="button" onClick={() => { void startSession(); }} className="btn-base btn-outline hidden md:inline-flex">Start Session</button></div>)}{missions.length <= 1 && <p className="py-4 text-sm font-semibold text-muted-foreground">No upcoming missions yet.</p>}</div></section>

      <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">Past Sessions</h2><span className="text-xs font-black">{total} min total</span></div><div className="card-surface overflow-hidden">{state.sessions.length === 0 ? <p className="p-6 text-center text-sm font-bold">No past sessions yet. Your first completed session will appear here.</p> : state.sessions.slice(0, 8).map((item) => { const open = selectedHistory === item.at; return <div key={item.at} className="border-b border-black/10 last:border-0"><button type="button" onClick={() => setSelectedHistory(open ? null : item.at)} className="grid w-full grid-cols-[1fr_1.6fr_.7fr_.8fr_28px] items-center gap-3 px-4 py-4 text-left hover:bg-primary-soft/40"><span className="text-xs font-black">{new Date(item.at).toLocaleDateString()}</span><span className="truncate text-xs font-black">{item.missionTitle}</span><span className="text-xs font-black">{item.minutes} min</span><span className="flex items-center gap-1 text-xs font-black"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />Completed</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></button>{open && <div className="bg-black p-5 text-white"><p className="text-[11px] font-black uppercase tracking-wider text-white">Session history</p><p className="mt-2 text-sm font-black">{item.note || "No note added."}</p>{item.completedTasks?.length ? <p className="mt-3 text-xs font-bold">Tasks completed: {item.completedTasks.length}/{item.tasks?.length ?? 0}</p> : null}{item.review && <div className="mt-4 grid gap-3 md:grid-cols-3"><div><p className="text-[10px] font-black uppercase">What BuildMyLogic saw</p><p className="mt-1 text-xs font-bold">{item.review.feedback}</p></div><div><p className="text-[10px] font-black uppercase">Next</p><p className="mt-1 text-xs font-bold">{item.review.nextStep}</p></div><div><p className="text-[10px] font-black uppercase">Skill</p><p className="mt-1 text-xs font-bold">{item.review.skillBoost}</p></div></div>}</div>}</div>; })}</div></section>

      <section className="card-surface p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">Submit completed project</h2><p className="mt-1 text-sm font-semibold">Select your real project folder on this computer, or upload a ZIP for AI review.</p></div><ShieldCheck className="h-5 w-5 text-primary" /></div><div className="mt-4 grid gap-3 md:grid-cols-2"><button type="button" onClick={() => { void pickProjectFolder(); }} disabled={pickingProject} className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft/40 px-4 py-5 text-sm font-black text-black hover:bg-primary-soft disabled:cursor-wait disabled:opacity-60"><FolderOpen className="h-5 w-5" />{pickingProject ? "Opening folder picker…" : projectFolder ? `Project: ${projectFolder}` : "Select your project folder"}</button><input ref={folderInputRef} type="file" multiple className="hidden" onChange={(e) => selectProjectFolder(e.target.files)} /><label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 bg-white px-4 py-5 text-sm font-black text-black hover:bg-black/[0.02]"><Upload className="h-4 w-4" />{zipBusy ? "Analyzing ZIP…" : zipName ? `Review ${zipName}` : "Upload project ZIP for AI review"}<input type="file" accept=".zip,application/zip" className="hidden" disabled={zipBusy} onChange={(e) => { void reviewZip(e.target.files?.[0]); e.currentTarget.value = ""; }} /></label></div>{projectFolder && <div className="mt-3 rounded-xl border border-black/10 bg-white px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-black/50">Selected project</p><div className="mt-1 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black">{projectFolder}</p>{projectFileCount > 0 && <span className="text-xs font-bold text-black/60">{projectFileCount} files selected</span>}</div><p className="mt-2 break-all text-[10px] font-bold text-black/45">{workspacePath}</p></div>}<p className="mt-3 text-xs font-bold text-black/55">BuildMyLogic's local bridge reads the exact folder path on your computer, so VS Code can open that workspace directly.</p></section>

      {projectReview && <ProjectReviewCard review={projectReview} onClose={() => setProjectReview(null)} />}
      {review && <section className="rounded-2xl border-2 border-primary bg-primary-soft p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-black"><Sparkles className="h-4 w-4 text-primary" /> Session review</h2><button type="button" onClick={() => setReview(null)}><XCircle className="h-4 w-4" /></button></div><p className="mt-3 text-sm font-black">{review.feedback}</p><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-white p-4"><p className="text-[10px] font-black uppercase">Next action</p><p className="mt-1 text-sm font-black">{review.nextStep}</p></div><div className="rounded-xl bg-white p-4"><p className="text-[10px] font-black uppercase">Skill evidence</p><p className="mt-1 text-sm font-black">{review.skillBoost}</p></div></div></section>}

      <section className="card-surface p-5"><h2 className="text-lg font-black">Close the session</h2><p className="mt-1 text-sm font-semibold">Write what you actually built. BuildMyLogic keeps this as your learning history.</p><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="I wired the form to the API but validation is still broken…" className="mt-3 w-full rounded-xl border border-black/15 bg-white p-3 text-sm font-semibold outline-none focus:border-primary" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={finish} disabled={saving || !activeMission} className="btn-base btn-primary-solid"><Timer className="h-4 w-4" />{saving ? "Reviewing…" : `Log ${elapsed} min & get feedback`}</button><button type="button" onClick={completeMission} disabled={!activeMission} className="btn-base btn-outline"><Check className="h-4 w-4" />Complete mission</button></div></section>
    </div>
  </AppShell>;
}

function SessionTasks({ remote, fallback, done, onToggle }: { remote?: RemoteCheckpoint[]; fallback: Array<{ title: string; minutes: number }>; done: number[]; onToggle: (index: number) => void }) {
  const evidenceTasks = remote?.length ? remote : undefined;
  const verified = evidenceTasks?.filter((task) => (task.evidence ?? (task.status === "passed" ? "verified" : "not_verified")) === "verified").length ?? done.length;
  const total = evidenceTasks?.length ?? fallback.length;
  return <section id="session-tasks" className="card-surface scroll-mt-24 p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Session Tasks</h2><p className="mt-1 text-sm font-semibold">Work through these in order. Code can be detected automatically; only passing tests verify a task.</p></div><span className="text-xs font-black">{verified}/{total} verified</span></div>{evidenceTasks && <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-black/50">✓ Verified · ◐ Detected · ○ Not verified</p>}<div className="mt-4 space-y-2">{evidenceTasks ? evidenceTasks.map((task) => { const evidence = task.evidence ?? (task.status === "passed" ? "verified" : "not_verified"); return <div key={`${task.title}-${task.index}`} className={`flex items-start gap-3 rounded-xl border p-4 ${evidence === "verified" ? "border-primary bg-primary-soft" : "border-black/10 bg-white"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${evidence === "verified" ? "border-primary bg-primary text-white" : evidence === "detected" ? "border-primary text-primary" : "border-black/20 text-black/40"}`}>{evidence === "verified" ? <Check className="h-4 w-4" /> : evidence === "detected" ? "◐" : "○"}</span><span className="min-w-0 flex-1"><b className="block text-sm">{task.title}</b><span className="mt-1 block text-xs font-semibold text-black/60">{evidence === "verified" ? "VERIFIED by passing tests" : evidence === "detected" ? "DETECTED from code activity · run tests to verify" : "NOT VERIFIED"}</span></span></div>; }) : fallback.map((task, index) => { const checked = done.includes(index); return <button type="button" key={`${task.title}-${index}`} onClick={() => onToggle(index)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${checked ? "border-primary bg-primary-soft" : "border-black/10 bg-white"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${checked ? "border-primary bg-primary text-white" : "border-black/20"}`}>{checked && <Check className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><b className="block text-sm">{task.title}</b><span className="mt-1 block text-xs font-semibold">{task.minutes} minutes</span></span></button>; })}</div></section>;
}

function ProjectReviewCard({ review, onClose }: { review: ProjectReview; onClose: () => void }) { const groups: [string, string[]][] = [["Strengths", review.strengths], ["Issues", review.issues], ["Security", review.security], ["Missing", review.missing], ["Next steps", review.nextSteps]]; return <section className="card-surface overflow-hidden"><div className="bg-black px-5 py-4 text-white"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-black"><ShieldCheck className="h-4 w-4" /> Project Review</h2><div className="flex items-center gap-2"><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-black">{review.score}/100</span><button type="button" onClick={onClose}><X className="h-4 w-4" /></button></div></div><p className="mt-3 text-sm font-black">{review.verdict}</p></div><div className="grid gap-5 p-5 md:grid-cols-2">{groups.map(([title, items]) => <div key={title} className="rounded-xl border border-black/10 bg-white p-4"><h3 className="text-sm font-black">{title}</h3><ul className="mt-2 space-y-2">{items.length ? items.map((item, i) => <li key={i} className="text-sm font-bold leading-5">• {item}</li>) : <li className="text-sm font-bold">• None reported.</li>}</ul></div>)}</div></section>; }
function SessionProjectReview({ review }: { review: NonNullable<RemoteSessionState["project_review"]> }) { const groups: [string, string[]][] = [["Strengths", review.strengths], ["Issues", review.issues], ["Missing", review.missing], ["Next steps", review.nextSteps]]; return <section className="card-surface mt-5 overflow-hidden border-2 border-primary/30"><div className="bg-black px-5 py-4 text-white"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-black"><ShieldCheck className="h-4 w-4" /> BuildMyLogic project review</h2><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-black">{review.score}/100</span></div><p className="mt-3 text-sm font-black">{review.verdict}</p></div><div className="grid gap-3 p-4 md:grid-cols-4">{groups.map(([title, items]) => <div key={title} className="rounded-xl border border-black/10 bg-white p-3"><h3 className="text-xs font-black">{title}</h3><p className="mt-2 text-xs font-bold leading-5">{items[0] ?? "None reported."}</p></div>)}</div></section>; }
