import { useCloudHydrated } from "@/lib/cloud-sync";
import {
  PRACTICE_TASKS,
  suggestedPracticeId,
  harderPracticeRestart,
} from "@/lib/practice-task";
import { learningSchedule } from "@/lib/learning-schedule";
import { learnerStorage } from "@/lib/demo-mode";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  FolderOpen,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Timer,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  applyBuildSessionEvidence,
  applySarvamDashboardPlan,
  getLoopState,
  logActivity,
  recordMissionEvidence,
  setLoopState,
  useLoop,
} from "@/lib/loop-store";
import type { BuildSessionState, SessionReview } from "@/lib/loop-types";
import { aiReviewProjectZip, aiReviewSession } from "@/lib/sarvam.functions";
import {
  getAuthSession,
  getAuthEpoch,
  getAuthSessionForApi,
  useAuth,
} from "@/lib/auth";
import type { ProjectReview } from "@/lib/project-review";

export const Route = createFileRoute("/sessions")({
  head: () => ({ meta: [{ title: "Sessions — BuildMyLogic" }] }),
  component: Sessions,
});
const BRIDGE_URL = "http://127.0.0.1:8091";
type RemoteSessionState = BuildSessionState & {
  extension_status: string;
  checkpoints?: RemoteCheckpoint[];
};
type RemoteCheckpoint = {
  index: number;
  title: string;
  detail: string;
  status: "locked" | "active" | "passed" | "failed";
  evidence?: "not_verified" | "detected" | "verified";
  attempts: number;
  lastOutput?: string;
};

function difficultyLabel(difficulty: number) {
  if (difficulty <= 1) return "Beginner";
  if (difficulty === 2) return "Intermediate";
  return "Advanced";
}

function Sessions() {
  const state = useLoop();
  const pairingAuth = useAuth();
  const cloudHydrated = useCloudHydrated(pairingAuth?.uid);
  const navigate = useNavigate();
  const plan = state.plan;
  const sessionPlan = plan?.session;
  const planned = sessionPlan?.totalMinutes ?? 45;
  const missions = plan?.missions ?? [];
  const activeMission =
    missions.find((m) => state.missionProgress[m.id]?.status !== "done") ??
    missions[0];
  const nextMission = activeMission
    ? missions[missions.findIndex((m) => m.id === activeMission.id) + 1]
    : undefined;
  const storedStartedAt =
    typeof window !== "undefined"
      ? Number(learnerStorage.getItem("loop-session-started-at") || 0)
      : 0;
  const storedDuration =
    typeof window !== "undefined"
      ? Number(learnerStorage.getItem("loop-session-duration") || 0)
      : 0;
  const initialRemaining =
    storedStartedAt && storedDuration
      ? Math.max(
          0,
          storedDuration - Math.floor((Date.now() - storedStartedAt) / 1000),
        )
      : planned * 60;
  const [seconds, setSeconds] = useState(initialRemaining);
  const [running, setRunning] = useState(
    Boolean(storedStartedAt && initialRemaining > 0),
  );
  const [done, setDone] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState<SessionReview | null>(null);
  const [projectReview, setProjectReview] = useState<ProjectReview | null>(
    null,
  );
  const [zipBusy, setZipBusy] = useState(false);
  const [zipName, setZipName] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<number | null>(null);
  const [workspacePath, setWorkspacePath] = useState("");
  const [projectFolder, setProjectFolder] = useState("");
  const [projectFileCount, setProjectFileCount] = useState(0);
  const [pickingProject, setPickingProject] = useState(false);
  const [vscodeSession, setVscodeSession] = useState<{
    sessionId: string;
    status?: string;
  } | null>(null);
  const [remoteState, setRemoteState] = useState<RemoteSessionState | null>(
    null,
  );
  const [pickerError, setPickerError] = useState("");
  const [practiceNotice, setPracticeNotice] = useState("");
  const [practiceSelection, setPracticeSelection] = useState("");
  const [attachSessionId, setAttachSessionId] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);
  const practiceStarting = useRef(false);
  const [practiceBusy, setPracticeBusy] = useState(false);
  const statedContext = [
    state.profile?.goalDetail,
    state.profile?.experienceDetail,
    ...(state.profile?.followUps ?? []).map((item) => item.answer),
  ]
    .filter(Boolean)
    .join(" ");
  const suggestedPractice = PRACTICE_TASKS.find(
    (task) => task.id === suggestedPracticeId(statedContext),
  );
  const [copyNotice, setCopyNotice] = useState("");
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const startRef = useRef(planned * 60);
  const connectionTokenRef = useRef<string | undefined>(undefined);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingExpiry, setPairingExpiry] = useState("");
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingError, setPairingError] = useState("");
  useEffect(() => {
    setPairingCode("");
    setPairingExpiry("");
    setPairingError("");
  }, [pairingAuth?.uid, vscodeSession?.sessionId]);
  useEffect(() => {
    setPracticeNotice("");
    setPracticeSelection("");
  }, [pairingAuth?.uid]);
  async function showPairingCode() {
    if (pairingBusy || practiceStarting.current) return;
    setPairingBusy(true);
    setPairingError("");
    setPairingCode("");
    try {
      const epoch = getAuthEpoch();
      const auth = await getAuthSessionForApi();
      if (!auth?.idToken)
        throw Error("Sign in before creating a pairing code.");
      if (vscodeSession && !connectionTokenRef.current)
        throw Error(
          "Your saved task is preserved. Reconnect this Session ID in the VS Code extension that already paired it. A new pairing code cannot be created after this page was reloaded; no replacement session was started.",
        );
      const linked =
        connectionTokenRef.current && vscodeSession
          ? vscodeSession
          : await createVscodeSession();
      if (getAuthSession()?.uid !== auth.uid || getAuthEpoch() !== epoch)
        throw Error("Account changed. Try again.");
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(linked.sessionId)}/pairing/create`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${auth.idToken}`,
          },
          body: JSON.stringify({
            connection_token: connectionTokenRef.current,
          }),
        },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        code?: string;
        expires_at?: string;
        error?: string;
      };
      if (getAuthSession()?.uid !== auth.uid || getAuthEpoch() !== epoch)
        return;
      if (!response.ok || !result.ok || !result.code || !result.expires_at)
        throw Error(result.error || "Could not create a pairing code.");
      setPairingCode(result.code);
      setPairingExpiry(result.expires_at);
    } catch (error) {
      setPairingError(
        error instanceof Error ? error.message : "Pairing is unavailable.",
      );
    } finally {
      setPairingBusy(false);
    }
  }

  useEffect(() => {
    const saved = learnerStorage.getItem("loop-vscode-path") ?? "";
    const savedProject = learnerStorage.getItem("loop-project-folder") ?? "";
    const savedSession = learnerStorage.getItem("bml-vscode-session");
    setWorkspacePath(saved);
    setProjectFolder(savedProject);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession) as {
          sessionId?: string;
          status?: string;
        };
        if (parsed.sessionId && /^BML-[A-Z0-9]{5}$/i.test(parsed.sessionId))
          setVscodeSession({ sessionId: parsed.sessionId, status: "waiting" });
        else learnerStorage.removeItem("bml-vscode-session");
      } catch {
        learnerStorage.removeItem("bml-vscode-session");
      }
    }
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    if (learnerStorage.getItem("loop-session-started-at")) return;
    startRef.current = planned * 60;
    setSeconds(planned * 60);
  }, [planned]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(
      () =>
        setSeconds((value) => {
          if (value <= 1) {
            setRunning(false);
            learnerStorage.removeItem("loop-session-started-at");
            learnerStorage.removeItem("loop-session-duration");
            return 0;
          }
          return value - 1;
        }),
      1000,
    );
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (learnerStorage.getItem("loop-auto-start-session") !== "1") return;
    learnerStorage.removeItem("loop-auto-start-session");
    // Use the same flow as the visible Start Session button. This means a
    // mission launched from another page also selects a folder, creates the
    // shared session, and opens the extension in that workspace.
    window.setTimeout(() => {
      void startSession();
    }, 0);
  }, []);

  useEffect(() => {
    if (!vscodeSession) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const epoch = getAuthEpoch();
        const auth = await getAuthSessionForApi();
        if (
          !auth ||
          getAuthEpoch() !== epoch ||
          getAuthSession()?.uid !== auth.uid
        )
          return;
        const response = await fetch(
          `/api/sessions/${encodeURIComponent(vscodeSession.sessionId)}/state`,
          {
            cache: "no-store",
            headers: auth?.idToken
              ? { Authorization: `Bearer ${auth.idToken}` }
              : {},
          },
        );
        const result = (await response.json()) as {
          ok?: boolean;
          state?: RemoteSessionState;
        };
        if (getAuthEpoch() !== epoch || getAuthSession()?.uid !== auth.uid)
          return;
        if (!cancelled && result.ok && result.state) {
          setRemoteState(result.state);
          setVscodeSession((current) => {
            if (!current) return current;
            const status =
              result.state?.extension_status ?? result.state?.status;
            return status ? { ...current, status } : current;
          });
        } else if (
          !cancelled &&
          (response.status === 401 ||
            response.status === 403 ||
            response.status === 404)
        ) {
          setVscodeSession(null);
          setRemoteState(null);
          learnerStorage.removeItem("bml-vscode-session");
          setPickerError(
            "This session could not be opened for the signed-in account. Existing learner history is unchanged. Start a new secure session with extension v0.3.10.",
          );
        }
      } catch {
        /* Retain the last confirmed state while offline. */
      }
    };
    void sync();
    const id = window.setInterval(() => void sync(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [vscodeSession?.sessionId]);

  useEffect(() => {
    if (!remoteState || !pairingAuth?.uid || !cloudHydrated) return;
    const completed = remoteState.status === "completed";
    const shouldRetune =
      completed ||
      remoteState.status === "failed" ||
      Boolean(remoteState.potential_struggle);
    if (
      !shouldRetune &&
      !PRACTICE_TASKS.some((t) => t.id === remoteState.challenge_id)
    )
      return;
    applyBuildSessionEvidence(remoteState, pairingAuth.uid);
    // Ingest finite evidence only. Opening/polling Sessions must not spend AI
    // credits or rewrite the learner's roadmap from a passive event signal.
  }, [pairingAuth?.uid, remoteState, cloudHydrated]);

  const elapsed = Math.max(1, Math.round((startRef.current - seconds) / 60));
  const pct = startRef.current
    ? Math.min(100, ((startRef.current - seconds) / startRef.current) * 100)
    : 0;
  const total = state.sessions.reduce((sum, item) => sum + item.minutes, 0);
  const currentTasks = sessionPlan?.tasks ?? [
    { title: "Read the mission brief", minutes: 5 },
    { title: "Implement the next piece", minutes: 25 },
    { title: "Run and verify your work", minutes: 10 },
    { title: "Write down what changed", minutes: 5 },
  ];
  const extensionStatus =
    remoteState?.extension_status ?? vscodeSession?.status ?? "waiting";
  const extensionConnected = remoteState?.connection_status
    ? remoteState.connection_status === "connected"
    : extensionStatus === "active" || extensionStatus === "connected";
  const sessionLabel =
    extensionStatus === "completed"
      ? "Challenge completed"
      : extensionStatus === "failed"
        ? "Recovery mode"
        : extensionStatus === "disconnected"
          ? "VS Code disconnected"
          : extensionConnected
            ? "VS Code connected"
            : "Waiting for VS Code";
  const remoteCheckpoints = (remoteState?.checkpoints ??
    []) as RemoteCheckpoint[];
  const verifiedCount = remoteCheckpoints.length
    ? remoteCheckpoints.filter(
        (task) =>
          (task.evidence ??
            (task.status === "passed" ? "verified" : "not_verified")) ===
          "verified",
      ).length
    : done.length;
  const tasksTotal = remoteCheckpoints.length || currentTasks.length;
  const testsLabel = remoteState?.test_score
    ? `${remoteState.test_score.passed} / ${remoteState.test_score.total}`
    : `${verifiedCount} / ${tasksTotal}`;
  const attemptsLabel = remoteState
    ? remoteState.attempts
    : Math.max(1, state.sessions.length + 1);
  const remotePractice =
    remoteState &&
    PRACTICE_TASKS.some((t) => t.id === remoteState.challenge_id);
  const displayPct = remotePractice
    ? remoteCheckpoints.length
      ? Math.round(
          (100 *
            remoteCheckpoints.filter((c) => c.status === "passed").length) /
            remoteCheckpoints.length,
        )
      : 0
    : undefined;
  const activeStepsDone = activeMission
    ? (state.missionProgress[activeMission.id]?.completedSteps?.length ?? 0)
    : 0;
  const activeStepsTotal = activeMission?.steps.length ?? 1;
  const missionPct = activeMission
    ? Math.min(100, Math.round((activeStepsDone / activeStepsTotal) * 100))
    : 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMinutes =
    state.sessions
      .filter((s) => s.at >= todayStart.getTime())
      .reduce((sum, s) => sum + s.minutes, 0) +
    (running || seconds < startRef.current ? elapsed : 0);

  async function attachExistingSession() {
    const id = attachSessionId.trim().toUpperCase();
    if (!/^BML-[A-Z0-9]{5}$/.test(id)) {
      setPairingError("Enter the Session ID shown in VS Code.");
      return;
    }
    setAttachBusy(true);
    setPairingError("");
    const epoch = getAuthEpoch();
    try {
      const auth = await getAuthSessionForApi();
      if (!auth?.idToken)
        throw new Error("Sign in as the owner of that session.");
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(id)}/state`,
        {
          headers: { Authorization: `Bearer ${auth.idToken}` },
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (getAuthEpoch() !== epoch || getAuthSession()?.uid !== auth.uid)
        throw new Error("Account changed. Try again while signed in.");
      if (
        !response.ok ||
        !result.ok ||
        result.state?.verified_owner_id !== auth.uid
      )
        throw new Error(
          "This account cannot open that session. Sign in as its owner; no session was changed.",
        );
      const session = {
        sessionId: id,
        status: result.state.extension_status ?? result.state.status,
      };
      connectionTokenRef.current = undefined;
      setVscodeSession(session);
      setRemoteState(result.state);
      learnerStorage.setItem("bml-vscode-session", JSON.stringify(session));
      setPracticeNotice(
        "Showing the VS Code session and its saved results. No re-pairing needed.",
      );
    } catch (error) {
      setPairingError(
        error instanceof Error ? error.message : "Could not open that session.",
      );
    } finally {
      setAttachBusy(false);
    }
  }
  async function createVscodeSession(
    practiceTask?: string,
    practiceTopic?: string,
  ) {
    const epoch = getAuthEpoch();
    if (!activeMission) throw new Error("No active mission is selected.");
    const auth = await getAuthSessionForApi();
    if (
      !auth?.idToken ||
      getAuthEpoch() !== epoch ||
      getAuthSession()?.uid !== auth.uid
    )
      throw new Error(
        "Account changed or signed out. Start again while signed in.",
      );
    const userId = auth.uid;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (auth?.idToken) headers["Authorization"] = `Bearer ${auth.idToken}`;
    const existingPending =
      practiceTask &&
      vscodeSession?.sessionId &&
      (remoteState?.challenge_id === "project-context-pending" ||
        PRACTICE_TASKS.some((t) => t.id === remoteState?.challenge_id));
    const response = await fetch(
      existingPending
        ? `/api/sessions/${encodeURIComponent(vscodeSession!.sessionId)}/practice-task`
        : "/api/sessions/start",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...(practiceTask ? { practice_task: practiceTask } : {}),
          ...(practiceTopic ? { practice_topic: practiceTopic } : {}),
          ...(existingPending &&
          remoteState?.challenge_id !== "project-context-pending"
            ? {
                replace_task: true,
                previous_challenge: remoteState?.challenge_id,
                task_generation: remoteState?.task_generation ?? 0,
              }
            : {}),
          challenge_id: "project-context-pending",
          user_id: userId,
          title: "Inspect your project before choosing a challenge",
          language: "Unassessed",
          concept: "unassessed project",
          instructions:
            "This is a secure pairing container, not an assigned coding assessment. In VS Code, consent to bounded project inspection before any project-specific task is selected. Unsupported source contexts remain explicitly unassessed. Existing roadmap missions are unchanged.",
          expected_skills: [],
          checkpoints: [
            {
              title: "Project inspection pending",
              detail:
                "No challenge or evaluator has been selected. Inspect supported source in VS Code first.",
            },
          ],
        }),
      },
    );
    const result = (await response.json()) as {
      connection_token?: string;
      ok?: boolean;
      session_id?: string;
      state?: RemoteSessionState;
      error?: string;
    };
    if (getAuthEpoch() !== epoch || getAuthSession()?.uid !== auth.uid)
      throw new Error(
        "Account changed or signed out. The old session was not attached.",
      );
    if (!response.ok || !result.ok || !result.session_id)
      throw new Error(
        result.error || "Could not create the BuildMyLogic VS Code session.",
      );
    if (existingPending) {
      setRemoteState(result.state ?? null);
      return { sessionId: result.session_id, status: result.state?.status };
    }
    connectionTokenRef.current = result.connection_token;
    const session = { sessionId: result.session_id, status: "waiting" };
    setVscodeSession(session);
    setRemoteState(result.state ?? null);
    learnerStorage.setItem("bml-vscode-session", JSON.stringify(session));
    return { ...session, userId };
  }

  async function connectExtension(session: { sessionId: string }) {
    if (!connectionTokenRef.current)
      throw new Error(
        "Start a new session to securely pair this extension. Existing saved learner work is unchanged.",
      );
    const uri = `vscode://buildmylogic.buildmylogic/connect?token=${encodeURIComponent(connectionTokenRef.current)}&sessionId=${encodeURIComponent(session.sessionId)}&apiBaseUrl=${encodeURIComponent(window.location.origin)}`;
    const anchor = document.createElement("a");
    anchor.href = uri;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function openVsCode(
    session?: { sessionId: string },
    selectedPath?: string,
  ) {
    // A project folder is optional: the extension can connect without one.
    const path = (selectedPath ?? workspacePath).trim();
    try {
      const response = await fetch(
        `${BRIDGE_URL}/${session ? "open-vscode-session" : "open-vscode"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            session
              ? {
                  path,
                  session_id: session.sessionId,
                  api_base_url: window.location.origin,
                }
              : { path },
          ),
          signal: AbortSignal.timeout(1200),
        },
      ).catch(() => null);

      if (response && response.ok) {
        // The desktop bridge opens the selected folder and forwards the URI.
        // Send the URI from the browser too so the extension dashboard opens
        // and connects even when the second `code` process is delayed.
        if (session) await connectExtension(session);
        return;
      }
      // Fallback: connect the extension through the URI handler directly.
      if (session) {
        await connectExtension(session);
        return;
      }
      if (path) {
        const formattedPath = path.startsWith("/") ? path : `/${path}`;
        const anchor = document.createElement("a");
        anchor.href = `vscode://file${encodeURI(formattedPath)}`;
        anchor.click();
      }
    } catch {
      if (session) {
        await connectExtension(session);
        return;
      }
      if (path) {
        const formattedPath = path.startsWith("/") ? path : `/${path}`;
        const anchor = document.createElement("a");
        anchor.href = `vscode://file${encodeURI(formattedPath)}`;
        anchor.click();
      }
    }
  }

  async function pickProjectFolder(forOpening = false): Promise<string> {
    setPickingProject(true);
    setPickerError("");
    try {
      // Allow time for Chrome's local-network permission prompt. A short
      // transport timeout also aborts while the learner is reading it.
      let healthTimedOut = false;
      const health = await fetch(`${BRIDGE_URL}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      }).catch((error: unknown) => {
        healthTimedOut =
          error instanceof Error && error.name === "TimeoutError";
        return null;
      });

      if (health && health.ok) {
        // The bridge answered, so VS Code and the extension are running. A
        // failed pick here means the folder dialog was closed without a
        // choice, not that the bridge is missing - say so honestly.
        try {
          const response = await fetch(`${BRIDGE_URL}/pick-folder`, {
            method: "POST",
          });
          const result = (await response.json()) as {
            ok?: boolean;
            path?: string;
            error?: string;
          };
          if (response.ok && result.ok && result.path) {
            const path = result.path.trim().replace(/[\\/]+$/, "");
            const folder = path.split(/[\\/]/).filter(Boolean).pop() || path;
            setWorkspacePath(path);
            setProjectFolder(folder);
            setProjectFileCount(0);
            learnerStorage.setItem("loop-vscode-path", path);
            learnerStorage.setItem("loop-project-folder", folder);
            return path;
          }
          setPickerError(
            forOpening
              ? "No folder was selected, so nothing started. Tap again when you are ready to choose the folder."
              : "No folder was selected in VS Code. Tap again to reopen the folder dialog, or pick the folder below instead.",
          );
          return "";
        } catch {
          setPickerError(
            "The BuildMyLogic desktop bridge stopped answering mid-request. Keep VS Code open and try again.",
          );
          return "";
        }
      }
      // A failed browser request does not establish whether the extension
      // is missing, stopped, or blocked by local-network permissions.
      setPickerError(
        healthTimedOut
          ? "The connection check timed out. Nothing started. If Chrome is asking for local-network access, choose Allow, then try again. Keep VS Code open."
          : "This browser could not connect to VS Code. Nothing started. Keep VS Code open with BuildMyLogic installed. If Chrome blocked local-network access, allow it in this site's permissions, then try again.",
      );
      // The browser picker fallback opens only from the standalone Select
      // Folder buttons (an explicit choice), never inside the gated flows.
      if (!forOpening) folderInputRef.current?.click();
      return "";
    } catch {
      if (!forOpening) folderInputRef.current?.click();
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
    learnerStorage.removeItem("loop-session-started-at");
    learnerStorage.removeItem("loop-session-duration");
  }

  function selectProjectFolder(files: FileList | null) {
    if (!files?.length) return;
    const first = files[0];
    if (!first) return;
    const relative =
      (first as File & { webkitRelativePath?: string }).webkitRelativePath ??
      first.name;
    const folder = relative.split("/")[0] || first.name;
    setProjectFolder(folder);
    setProjectFileCount(files.length);
    learnerStorage.setItem("loop-project-folder", folder);
  }

  async function startSession(forceNew = false) {
    if (running && !forceNew) {
      if (vscodeSession) {
        const auth = await getAuthSessionForApi();
        await fetch(
          `/api/sessions/${encodeURIComponent(vscodeSession.sessionId)}/events`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(auth?.idToken
                ? { Authorization: `Bearer ${auth.idToken}` }
                : {}),
            },
            body: JSON.stringify({
              event_type: "work_pause",
              payload: { paused: true },
            }),
          },
        ).catch(() => {});
      }
      setRunning(false);
      learnerStorage.removeItem("loop-session-started-at");
      learnerStorage.removeItem("loop-session-duration");
      return;
    }
    // Irfan, 2026-11-16: every new session asks for the project folder first;
    // a previously saved folder is never reused silently. The folder is a
    // gate: cancel or an unreachable bridge leaves the session unstarted.
    // Earlier selections never count as a choice for this new attempt.
    const selectedPath = (await pickProjectFolder(true)).trim();
    if (!selectedPath) return;
    try {
      const duration = forceNew ? startRef.current : seconds;
      if (forceNew) {
        setVscodeSession(null);
        setRemoteState(null);
        learnerStorage.removeItem("bml-vscode-session");
      }
      const startedAt = Date.now();
      if (forceNew) setSeconds(duration);
      learnerStorage.setItem("loop-session-started-at", String(startedAt));
      learnerStorage.setItem("loop-session-duration", String(duration));
      setRunning(true);
    } catch (error) {
      setPickerError(
        error instanceof Error
          ? error.message
          : "Could not start the BuildMyLogic session.",
      );
      setRunning(false);
      return;
    }
    // After the folder is chosen, the rest of the extension work happens:
    // create the shared session and open VS Code in that workspace.
    if (selectedPath) {
      try {
        if (vscodeSession) {
          setPracticeNotice(
            "Your existing session is kept. Use the VS Code session ID below if another tab shows a different one.",
          );
        } else {
          const connected = await createVscodeSession();
          await openVsCode(connected, selectedPath);
        }
      } catch (error) {
        setRunning(false);
        learnerStorage.removeItem("loop-session-started-at");
        learnerStorage.removeItem("loop-session-duration");
        setPickerError(
          error instanceof Error ? error.message : "Could not connect VS Code.",
        );
      }
    }
  }

  async function openAndConnectVsCode() {
    try {
      // Irfan, 2026-11-16: Open VS Code always asks which folder first; the
      // saved path is never reused silently. Cancelling the ask stops here -
      // no session is created and nothing opens without a selected folder.
      const selectedPath = (await pickProjectFolder(true)).trim();
      if (!selectedPath) return;
      const hasFreshSession = Boolean(
        connectionTokenRef.current &&
        vscodeSession?.sessionId &&
        /^BML-[A-Z0-9]{5}$/i.test(vscodeSession.sessionId),
      );
      const connected =
        hasFreshSession && vscodeSession
          ? vscodeSession
          : await createVscodeSession();
      await openVsCode(connected, selectedPath);
    } catch (error) {
      setPickerError(
        error instanceof Error ? error.message : "Could not connect VS Code.",
      );
    }
  }

  function disconnectVsCode() {
    setVscodeSession(null);
    setRemoteState(null);
    learnerStorage.removeItem("bml-vscode-session");
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
      setCopyNotice(
        "Session ID copied for reference only. Use Create pairing code to connect VS Code.",
      );
    } catch {
      setCopyNotice("Copy failed. Select the Session ID and copy it manually.");
    }
  }

  async function finish() {
    if (saving || !activeMission) return;
    setSaving(true);
    setRunning(false);
    try {
      const result = await aiReviewSession({
        data: { missionTitle: activeMission.title, note, minutes: elapsed },
      });
      setReview(result);
      setLoopState((prev) => ({
        ...prev,
        sessions: [
          {
            at: Date.now(),
            minutes: elapsed,
            missionTitle: activeMission.title,
            note,
            tasks: currentTasks,
            completedTasks: done,
            review: result,
          },
          ...prev.sessions,
        ].slice(0, 40),
      }));
      logActivity({
        kind: "session",
        text: `Logged a ${elapsed} min session on ${activeMission.title}`,
      });
      recordMissionEvidence(activeMission.id, 2);
      if (done.length) {
        setLoopState((prev) => ({
          ...prev,
          missionProgress: {
            ...prev.missionProgress,
            [activeMission.id]: {
              ...(prev.missionProgress[activeMission.id] ?? {
                status: "active",
                completedSteps: [],
              }),
              completedSteps: Array.from(
                new Set([
                  ...(prev.missionProgress[activeMission.id]?.completedSteps ??
                    []),
                  ...done,
                ]),
              ),
            },
          },
        }));
      }
      setNote("");
      learnerStorage.removeItem("loop-session-started-at");
      learnerStorage.removeItem("loop-session-duration");
    } catch (error) {
      setReview({
        feedback:
          error instanceof Error
            ? error.message
            : "Could not review this session.",
        nextStep: "Try logging the session again.",
        skillBoost: "—",
      });
    } finally {
      setSaving(false);
    }
  }

  function completeMission() {
    if (!activeMission) return;
    const index = missions.findIndex((m) => m.id === activeMission.id);
    const next = missions[index + 1];
    learnerStorage.removeItem("loop-session-started-at");
    learnerStorage.removeItem("loop-session-duration");
    setLoopState((prev) => ({
      ...prev,
      missionProgress: {
        ...prev.missionProgress,
        [activeMission.id]: {
          ...(prev.missionProgress[activeMission.id] ?? {
            status: "active",
            completedSteps: [],
          }),
          status: "done",
          completedSteps: Array.from(
            { length: activeMission.steps.length },
            (_, i) => i,
          ),
        },
        ...(next
          ? {
              [next.id]: {
                ...(prev.missionProgress[next.id] ?? {
                  status: "locked",
                  completedSteps: [],
                }),
                status: "active",
              },
            }
          : {}),
      },
    }));
    recordMissionEvidence(activeMission.id, 5);
    logActivity({
      kind: "mission",
      text: `Completed mission “${activeMission.title}”`,
    });
  }

  async function reviewZip(file: File | undefined) {
    if (!file || zipBusy) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setReview({
        feedback: "Please choose a .zip project archive.",
        nextStep: "Zip the completed project source and upload it again.",
        skillBoost: "Project hygiene",
      });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setReview({
        feedback: "That ZIP is over the 8 MB upload limit.",
        nextStep:
          "Remove node_modules, dist and build folders, then upload the source ZIP.",
        skillBoost: "Project hygiene",
      });
      return;
    }
    setZipBusy(true);
    setZipName(file.name);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const result = await aiReviewProjectZip({
        data: activeMission?.title
          ? {
              fileName: file.name,
              dataBase64: btoa(binary),
              missionTitle: activeMission.title,
            }
          : { fileName: file.name, dataBase64: btoa(binary) },
      });
      setProjectReview(result);
      logActivity({ kind: "ai", text: `AI reviewed ${file.name}` });
    } catch (error) {
      setReview({
        feedback:
          error instanceof Error
            ? error.message
            : "Could not review the project ZIP.",
        nextStep: "Check the archive and try again.",
        skillBoost: "—",
      });
    } finally {
      setZipBusy(false);
    }
  }

  return (
    <AppShell
      crumb="Sessions"
      title="Your Learning Sessions"
      subtitle="Code, build and improve with real projects."
      quote="Turn your learning into real work."
      wide
    >
      {/* VS Code Integration banner */}
      <section className="card-surface flex flex-wrap items-center gap-4 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Code2 className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[16px] font-extrabold">VS Code Integration</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${extensionConnected ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${extensionConnected ? "bg-emerald-500" : "bg-red-500"}`}
              />
              {extensionConnected ? "Connected" : "Not connected"}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {extensionConnected
              ? "BuildMyLogic extension is running and tracking your progress."
              : vscodeSession
                ? `${sessionLabel}. Keep your saved result. If VS Code shows another ID, use "Already connected in VS Code?" below.`
                : "Connect the BuildMyLogic extension to track your real work."}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              void openAndConnectVsCode();
            }}
            disabled={pickingProject}
            className="btn-base btn-outline rounded-full disabled:cursor-wait disabled:opacity-60"
          >
            <Code2 className="h-4 w-4" /> Open VS Code
          </button>
          {vscodeSession ? (
            <button
              type="button"
              onClick={disconnectVsCode}
              className="rounded-full px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:bg-muted"
            >
              Disconnect
            </button>
          ) : (
            <a
              href="/extension.html"
              className="rounded-full px-3 py-2 text-[13px] font-semibold text-accent-foreground hover:bg-muted"
            >
              Install extension →
            </a>
          )}
        </div>
      </section>

      {remoteState?.surprise_test?.enabled &&
        ["completed", "failed"].includes(remoteState.status) &&
        remoteState.attempts > 0 &&
        Object.values(state.surpriseTests ?? {}).some(
          (result) =>
            result.id ===
            `${pairingAuth?.uid}:${remoteState.session_id}:${remoteState.task_generation ?? 0}:${remoteState.challenge_id}`,
        ) && (
          <section
            className="card-surface mt-5 p-5"
            aria-label="Surprise test result"
          >
            <h2 className="text-lg font-bold">Surprise test revealed</h2>
            <p className="mt-2">
              This question was a surprise test.{" "}
              {remoteState.test_score?.passed ?? 0}/
              {remoteState.test_score?.total ?? 0} finite checks passed across{" "}
              {remoteState.attempts} attempts.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your result is kept privately in Progress → Surprise Tests after
              sync. Local execution is extension-reported, not general mastery.
              Career-readiness scores and your roadmap are unchanged.
            </p>
            <a
              className="mt-3 inline-block text-primary underline"
              href="/progress?view=surprise"
            >
              Open Surprise Tests
            </a>
          </section>
        )}

      {remoteState?.project_review && (
        <SessionProjectReview review={remoteState.project_review} />
      )}

      {/* Current Session + Your Progress */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="card-surface p-6 sm:p-7 lg:col-span-7">
          <div className="flex h-full flex-col justify-between gap-6 sm:flex-row">
            <div className="min-w-0">
              <span className="pill bg-primary-soft text-accent-foreground">
                Current Session
              </span>
              <h2 className="display mt-4 text-[22px] font-extrabold leading-tight tracking-[-0.02em]">
                {remoteState &&
                PRACTICE_TASKS.some((t) => t.id === remoteState.challenge_id)
                  ? remoteState.title
                  : (activeMission?.title ?? "Your build")}
              </h2>
              <p className="mt-2 max-w-md text-[13.5px] leading-6 text-muted-foreground">
                {remoteState &&
                PRACTICE_TASKS.some((t) => t.id === remoteState.challenge_id)
                  ? remoteState.instructions
                  : (activeMission?.description ??
                    "Build something useful and prove what you learned.")}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Timer className="h-4 w-4 text-primary" />
                  Level{" "}
                  {remotePractice
                    ? "Beginner"
                    : difficultyLabel(activeMission?.difficulty ?? 1)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {remotePractice
                    ? `${remoteState?.language} · ${remoteState?.concept}`
                    : (activeMission?.skills ?? []).join(" · ") || "Skills"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Est. Time ~
                  {remotePractice
                    ? Math.round(
                        (remoteState?.expected_duration_ms ?? 300000) / 60000,
                      )
                    : (activeMission?.minutes ?? planned)}{" "}
                  min
                </span>
              </div>
              {remotePractice ? (
                <p className="mt-5 text-sm font-semibold">
                  Work on this question in VS Code, then click Submit to check
                  your code.
                </p>
              ) : (
                <>
                  {" "}
                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        void startSession();
                      }}
                      disabled={!activeMission || pickingProject}
                      className="btn-base btn-primary-solid"
                    >
                      {running ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {running
                        ? "Pause Session"
                        : seconds < startRef.current
                          ? "Continue Session"
                          : "Start Session"}
                    </button>
                    <a href="#session-tasks" className="btn-base btn-outline">
                      View Tasks
                    </a>
                    {(running || seconds < startRef.current) && (
                      <button
                        type="button"
                        onClick={restartSession}
                        className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold text-muted-foreground hover:bg-muted"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restart
                      </button>
                    )}
                  </div>
                </>
              )}
              {!remotePractice && (running || seconds < startRef.current) && (
                <p className="mt-3 text-[12px] font-semibold text-muted-foreground">
                  {running ? "● Live now" : "Ⅱ Paused"} · {elapsed} min elapsed
                  · {Math.max(0, Math.ceil(seconds / 60))} min remaining
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
            <span className="text-[13px] font-bold">
              {displayPct ?? missionPct}% Complete
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${displayPct ?? missionPct}%` }}
            />
          </div>
          <div className="mt-4 space-y-1.5">
            {(remotePractice
              ? remoteCheckpoints
              : (activeMission?.steps ?? [])
            ).map((step, index) => {
              const isDone = remotePractice
                ? remoteCheckpoints[index]?.status === "passed"
                : activeMission
                  ? (state.missionProgress[
                      activeMission.id
                    ]?.completedSteps?.includes(index) ?? false)
                  : false;
              const isCurrent =
                !isDone &&
                (remotePractice
                  ? remoteCheckpoints.findIndex(
                      (c) => c.status !== "passed",
                    ) === index
                  : index === activeStepsDone);
              return (
                <div
                  key={step.title}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isCurrent ? "bg-primary-soft" : ""}`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isDone ? "bg-emerald-500 text-white" : isCurrent ? "border-2 border-primary bg-card" : "border-2 border-border"}`}
                  >
                    {isDone && <Check className="h-3 w-3" strokeWidth={3.2} />}
                  </span>
                  <p
                    className={`text-[13px] ${isDone ? "font-semibold" : isCurrent ? "font-semibold" : "text-muted-foreground"}`}
                  >
                    {step.title}{" "}
                    {isCurrent && (
                      <span className="font-bold text-accent-foreground">
                        (Current)
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
            {!activeMission && (
              <p className="text-[13px] font-semibold text-muted-foreground">
                Finish onboarding to unlock your session plan.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <section className="card-surface p-5">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
            <Code2 className="h-4 w-4 text-primary" />
            Tests / Tasks Passed
          </div>
          <p className="display mt-2 text-[24px] font-black">{testsLabel}</p>
        </section>
        <section className="card-surface p-5">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
            <RotateCcw className="h-4 w-4 text-primary" />
            Attempts
          </div>
          <p className="display mt-2 text-[24px] font-black">{attemptsLabel}</p>
        </section>
        <section className="card-surface p-5">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
            <FolderOpen className="h-4 w-4 text-primary" />
            Project Folder
          </div>
          <p className="mt-2 break-all text-[13px] font-bold leading-5">
            {workspacePath || projectFolder || "No folder selected"}
          </p>
          <button
            type="button"
            onClick={() => {
              void pickProjectFolder(true);
            }}
            disabled={pickingProject}
            className="btn-base btn-outline mt-2.5 w-full py-1.5 text-[11.5px] disabled:cursor-wait disabled:opacity-60"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {pickingProject
              ? "Selecting…"
              : workspacePath || projectFolder
                ? "Change Folder"
                : "Select Folder"}
          </button>
          {pickingProject && (
            <p
              role="status"
              className="mt-2 text-[11px] font-semibold text-muted-foreground"
            >
              Waiting for VS Code. If Chrome asks for local-network access,
              choose Allow. Then choose your folder in VS Code.
            </p>
          )}
          {pickerError && (
            <div
              role="alert"
              className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700"
            >
              <p>{pickerError}</p>
              {(pickerError.startsWith("This browser could not connect") ||
                pickerError.startsWith("The connection check timed out")) && (
                <>
                  <a
                    href={`${BRIDGE_URL}/health`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block underline"
                  >
                    Check VS Code connection
                  </a>
                  <p className="mt-1 font-normal">
                    If the check shows ok: true, return here and allow
                    local-network access. If it cannot open, follow the setup
                    guide.
                  </p>
                  <a
                    href="/extension.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block underline"
                  >
                    Open step-by-step setup
                  </a>
                </>
              )}
            </div>
          )}
        </section>
        <section className="card-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Session ID
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${extensionConnected ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${extensionConnected ? "bg-emerald-500" : "bg-red-500"}`}
              />
              {extensionConnected ? "Connected" : "Not connected"}
            </span>
          </div>
          {vscodeSession ? (
            <>
              <button
                type="button"
                title="Click to copy session ID"
                aria-label="Copy session ID"
                onClick={() => {
                  void copySessionId();
                }}
                className="mt-2.5 flex w-full items-center justify-center rounded-xl bg-ink px-3 py-2.5 text-center text-lg font-black tracking-[0.08em] text-ink-foreground transition hover:opacity-85"
              >
                {vscodeSession.sessionId}
              </button>
              <p className="mt-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Click the ID to copy
              </p>
              {copyNotice && (
                <p className="mt-1.5 text-center text-[10px] font-bold text-emerald-700">
                  {copyNotice}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2.5 rounded-xl bg-muted px-3 py-3.5 text-center text-[12px] font-semibold text-muted-foreground">
              Create a pairing code below. Opening VS Code automatically is
              optional.
            </p>
          )}
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-sm font-bold">Pair with a code</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              No launcher or folder picker needed. In VS Code, open BuildMyLogic
              and choose Enter pairing code. Type the code shown here. It
              expires in five minutes and works once. Keep it private.
            </p>
            <details className="mb-3 text-xs">
              <summary>Already connected in VS Code?</summary>
              <label className="mt-2 block">
                Session ID shown in VS Code
                <input
                  aria-label="VS Code Session ID"
                  value={attachSessionId}
                  onChange={(e) => setAttachSessionId(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2"
                  placeholder="BML-XXXXX"
                />
              </label>
              <button
                type="button"
                className="btn-base btn-outline mt-2 w-full"
                disabled={attachBusy}
                onClick={() => void attachExistingSession()}
              >
                {attachBusy ? "Checking owner..." : "Use this session"}
              </button>
              <p className="mt-2">
                Only the signed-in owner can open it. Existing attempts stay
                saved.
              </p>
            </details>
            <label className="mb-3 block text-xs font-bold">
              What do you want to practice in Python?
              <select
                aria-label="Python practice topic"
                disabled={pairingBusy || practiceBusy}
                value={practiceSelection}
                onChange={(e) => {
                  setPracticeSelection(e.target.value);
                  setPracticeNotice("");
                }}
                className="mt-2 w-full rounded-xl border border-border bg-background p-2 text-sm"
              >
                <option value="">Choose a topic</option>
                {PRACTICE_TASKS.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.concept}: {task.title}
                  </option>
                ))}
              </select>
            </label>
            {suggestedPractice && (
              <p className="mb-3 text-xs text-muted-foreground">
                Based on what you told us: {suggestedPractice.title}. Choose it
                if it fits. This is not a skill score.
              </p>
            )}
            {practiceSelection && (
              <p className="mb-3 whitespace-pre-line text-xs">
                {
                  PRACTICE_TASKS.find((task) => task.id === practiceSelection)
                    ?.question
                }
              </p>
            )}
            <button
              type="button"
              disabled={
                pairingBusy ||
                practiceBusy ||
                !practiceSelection ||
                Boolean(vscodeSession && !remoteState)
              }
              className="btn-base btn-outline mb-3 w-full"
              onClick={async () => {
                if (practiceStarting.current || !practiceSelection) return;
                if (
                  PRACTICE_TASKS.some(
                    (t) => t.id === remoteState?.challenge_id,
                  ) &&
                  !window.confirm(
                    "Change to this question? Earlier attempts will stay in task history. Requires extension v0.3.19 or newer.",
                  )
                )
                  return;
                practiceStarting.current = true;
                setPracticeBusy(true);
                setPracticeNotice("");
                setPickerError("");
                setPairingCode("");
                setPairingError("");
                try {
                  await createVscodeSession(practiceSelection);
                  setPickerError("");
                  setPracticeNotice(
                    vscodeSession &&
                      (remoteState?.challenge_id ===
                        "project-context-pending" ||
                        PRACTICE_TASKS.some(
                          (t) => t.id === remoteState?.challenge_id,
                        ))
                      ? "Task sent to this session. In VS Code, open your Python file. Changing questions needs v0.3.19 or newer."
                      : "Practice selected. Create a pairing code, then open your Python file in VS Code.",
                  );
                } catch (e) {
                  setPickerError(
                    e instanceof Error
                      ? e.message
                      : "Could not select practice.",
                  );
                } finally {
                  practiceStarting.current = false;
                  setPracticeBusy(false);
                }
              }}
            >
              {practiceBusy ? "Selecting task..." : "Use this Python task"}
            </button>
            {harderPracticeRestart(remoteState) && (
              <section
                id="harder-question"
                className="mb-4 rounded-xl border border-primary/40 bg-primary-soft p-4"
              >
                <h3 className="font-bold">Start with a harder question</h3>
                <p className="my-2 text-sm">
                  First: {harderPracticeRestart(remoteState)?.title}. After 3
                  wrong attempts, it automatically switches to Add two numbers.
                  All earlier results stay saved.
                </p>
                <button
                  type="button"
                  className="btn-base btn-primary-solid"
                  disabled={practiceBusy || pairingBusy}
                  onClick={async () => {
                    const task = harderPracticeRestart(remoteState);
                    if (!task || practiceStarting.current) return;
                    practiceStarting.current = true;
                    setPracticeBusy(true);
                    setPickerError("");
                    try {
                      await createVscodeSession(task.id);
                      setPracticeSelection(task.id);
                      setPracticeNotice(
                        "Harder question started. After 3 wrong attempts, Add two numbers starts automatically. Earlier results stay in history.",
                      );
                    } catch (e) {
                      setPickerError(
                        e instanceof Error
                          ? e.message
                          : "Could not start harder question. Saved results are unchanged.",
                      );
                    } finally {
                      practiceStarting.current = false;
                      setPracticeBusy(false);
                    }
                  }}
                >
                  Start harder question first
                </button>
              </section>
            )}
            {PRACTICE_TASKS.some((t) => t.id === remoteState?.challenge_id) && (
              <div className="mb-3 text-xs">
                <p className="mb-2 font-bold">
                  Current question:{" "}
                  {
                    PRACTICE_TASKS.find(
                      (t) => t.id === remoteState?.challenge_id,
                    )?.title
                  }
                </p>
                <p className="mb-3 whitespace-pre-line">
                  {
                    PRACTICE_TASKS.find(
                      (t) => t.id === remoteState?.challenge_id,
                    )?.question
                  }
                </p>
                <button
                  type="button"
                  className="btn-base btn-outline w-full"
                  disabled={practiceBusy || pairingBusy}
                  onClick={async () => {
                    if (practiceStarting.current || !remoteState) return;
                    if (
                      !window.confirm(
                        "Choose a different question on this topic? Earlier attempts stay saved. Requires extension v0.3.19 or newer.",
                      )
                    )
                      return;
                    practiceStarting.current = true;
                    setPracticeBusy(true);
                    setPickerError("");
                    try {
                      await createVscodeSession(
                        remoteState.challenge_id,
                        remoteState.concept,
                      );
                      setPracticeNotice(
                        "Different question sent. Earlier attempts stay in history. Use extension v0.3.19 or newer.",
                      );
                    } catch (e) {
                      setPickerError(
                        e instanceof Error
                          ? e.message
                          : "Could not change question.",
                      );
                    } finally {
                      practiceStarting.current = false;
                      setPracticeBusy(false);
                    }
                  }}
                >
                  Next different {remoteState?.concept} question
                </button>
                <p className="mt-2">
                  Authored questions per topic. After the available questions,
                  the least recently used question returns. Finite practice, not
                  a general skill test.
                </p>
              </div>
            )}
            {Boolean(remoteState?.practice_history?.length) && (
              <details className="mb-3 text-xs">
                <summary>
                  Earlier task attempts ({remoteState?.practice_history?.length}
                  )
                </summary>
                {remoteState?.practice_history?.map((entry, index) => (
                  <div key={index} className="mt-2 rounded-xl border p-2">
                    <b>{entry.title}</b>
                    <p>
                      {String(entry.state["attempts"] ?? 0)} attempts -{" "}
                      {String(entry.state["status"] ?? "unverified")}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {(Array.isArray(entry.state["attempt_history"])
                        ? entry.state["attempt_history"]
                        : []
                      ).map(
                        (
                          attempt: Record<string, unknown>,
                          attemptIndex: number,
                        ) => (
                          <li key={attemptIndex}>
                            Attempt{" "}
                            {String(attempt["attempt"] ?? attemptIndex + 1)}:{" "}
                            {String(attempt["passed"] ?? 0)}/
                            {String(attempt["total"] ?? 0)} checks passed
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                ))}
              </details>
            )}
            {practiceNotice && (
              <p
                role="status"
                className="mb-3 rounded-xl bg-primary-soft p-3 text-xs text-foreground"
              >
                {practiceNotice}
              </p>
            )}
            <p className="mb-3 text-xs text-muted-foreground">
              Standalone practice, not a test of your project. Choose a topic
              you want help with. Requires Python. Use extension v0.4.1 for the
              latest version: local code tests stay, with no AFK/idle tracking
              or AI/code-paste detection.
            </p>
            <button
              type="button"
              className="btn-base btn-primary mt-3 w-full"
              disabled={pairingBusy || practiceBusy}
              onClick={() => void showPairingCode()}
            >
              {pairingBusy ? "Creating code..." : "Create pairing code"}
            </button>
            {pairingCode ? (
              <div className="mt-3 rounded-xl border border-primary/20 bg-primary-soft p-3 text-center">
                <p
                  className="text-xl font-black tracking-widest"
                  aria-label="Pairing code"
                >
                  {pairingCode}
                </p>
                <p className="mt-2 text-xs">
                  Expires{" "}
                  {new Date(pairingExpiry).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  . Single use. A Session ID alone does not connect the
                  extension.
                </p>
              </div>
            ) : null}
            {pairingError ? (
              <p role="alert" className="mt-2 text-xs text-red-700">
                {pairingError}
              </p>
            ) : null}
          </div>
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
              <p className="display mt-2 text-[20px] font-black">
                {todayMinutes} min
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                Coding Time
              </p>
            </div>
            <div className="rounded-2xl bg-muted/70 p-4 text-center">
              <Timer className="mx-auto h-5 w-5 text-primary" />
              <p className="display mt-2 text-[20px] font-black">
                {state.sessions.length}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                Sessions Logged
              </p>
            </div>
            <div className="rounded-2xl bg-muted/70 p-4 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />
              <p className="display mt-2 text-[20px] font-black">
                {verifiedCount} / {tasksTotal}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                Tasks Verified
              </p>
            </div>
            <div className="rounded-2xl bg-muted/70 p-4 text-center">
              <CheckCircle2
                className={`mx-auto h-5 w-5 ${extensionConnected ? "text-emerald-600" : "text-muted-foreground"}`}
              />
              <p className="display mt-2 text-[20px] font-black">
                {extensionConnected ? "Synced" : "Local"}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                Evidence
              </p>
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
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                  <Code2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14.5px] font-bold">{nextMission.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">
                    {nextMission.description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void navigate({ to: "/learn" })}
                className="btn-base btn-outline mt-4 rounded-full bg-card"
              >
                View Next Task <ArrowRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <p className="mt-4 text-[13px] font-semibold text-muted-foreground">
              {activeMission
                ? "This is the last mission on your path. Finish it to complete the path."
                : "Finish onboarding to unlock your path."}
            </p>
          )}
        </section>
      </div>

      <div className="mt-5 space-y-5">
        <SessionTasks
          remote={remoteCheckpoints}
          fallback={currentTasks}
          done={done}
          onToggle={(index) =>
            setDone((prev) =>
              prev.includes(index)
                ? prev.filter((x) => x !== index)
                : [...prev, index],
            )
          }
        />

        <section className="card-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">Upcoming Sessions</h2>
            <span className="text-xs font-black">View All →</span>
          </div>
          <div className="mt-3 divide-y divide-black/10">
            {missions.slice(1, 3).map((mission) => (
              <div key={mission.id} className="flex items-center gap-4 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink text-ink-foreground">
                  <Timer className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">{mission.title}</p>
                  <p className="mt-1 text-xs font-semibold">
                    {mission.stack} · Difficulty {mission.difficulty} ·
                    {learningSchedule(state.profile).next}
                  </p>
                  <p className="mt-1 text-xs font-semibold">
                    {mission.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void startSession();
                  }}
                  disabled={pickingProject}
                  className="btn-base btn-outline hidden md:inline-flex"
                >
                  Start Session
                </button>
              </div>
            ))}
            {missions.length <= 1 && (
              <p className="py-4 text-sm font-semibold text-muted-foreground">
                No upcoming missions yet.
              </p>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Past Sessions</h2>
            <span className="text-xs font-black">{total} min total</span>
          </div>
          <div className="card-surface overflow-hidden">
            {state.sessions.length === 0 ? (
              <p className="p-6 text-center text-sm font-bold">
                No past sessions yet. Your first completed session will appear
                here.
              </p>
            ) : (
              state.sessions.slice(0, 8).map((item) => {
                const open = selectedHistory === item.at;
                return (
                  <div
                    key={item.at}
                    className="border-b border-black/10 last:border-0"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedHistory(open ? null : item.at)}
                      className="grid w-full grid-cols-[1fr_1.6fr_.7fr_.8fr_28px] items-center gap-3 px-4 py-4 text-left hover:bg-primary-soft/40"
                    >
                      <span className="text-xs font-black">
                        {new Date(item.at).toLocaleDateString()}
                      </span>
                      <span className="truncate text-xs font-black">
                        {item.missionTitle}
                      </span>
                      <span className="text-xs font-black">
                        {item.minutes} min
                      </span>
                      <span className="flex items-center gap-1 text-xs font-black">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                        Completed
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </button>
                    {open && (
                      <div className="bg-black p-5 text-white">
                        <p className="text-[11px] font-black uppercase tracking-wider text-white">
                          Session history
                        </p>
                        <p className="mt-2 text-sm font-black">
                          {item.note || "No note added."}
                        </p>
                        {item.completedTasks?.length ? (
                          <p className="mt-3 text-xs font-bold">
                            Tasks completed: {item.completedTasks.length}/
                            {item.tasks?.length ?? 0}
                          </p>
                        ) : null}
                        {item.review && (
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div>
                              <p className="text-[10px] font-black uppercase">
                                What BuildMyLogic saw
                              </p>
                              <p className="mt-1 text-xs font-bold">
                                {item.review.feedback}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase">
                                Next
                              </p>
                              <p className="mt-1 text-xs font-bold">
                                {item.review.nextStep}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase">
                                Skill
                              </p>
                              <p className="mt-1 text-xs font-bold">
                                {item.review.skillBoost}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="card-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Submit completed project</h2>
              <p className="mt-1 text-sm font-semibold">
                Select your real project folder on this computer, or upload a
                ZIP for AI review.
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                void pickProjectFolder();
              }}
              disabled={pickingProject}
              className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft/40 px-4 py-5 text-sm font-black text-black hover:bg-primary-soft disabled:cursor-wait disabled:opacity-60"
            >
              <FolderOpen className="h-5 w-5" />
              {pickingProject
                ? "Opening folder picker…"
                : projectFolder
                  ? `Project: ${projectFolder}`
                  : "Select your project folder"}
            </button>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => selectProjectFolder(e.target.files)}
            />
            <label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 bg-white px-4 py-5 text-sm font-black text-black hover:bg-black/[0.02]">
              <Upload className="h-4 w-4" />
              {zipBusy
                ? "Analyzing ZIP…"
                : zipName
                  ? `Review ${zipName}`
                  : "Upload project ZIP for AI review"}
              <input
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                disabled={zipBusy}
                onChange={(e) => {
                  void reviewZip(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          {projectFolder && (
            <div className="mt-3 rounded-xl border border-black/10 bg-white px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-black/50">
                Selected project
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">{projectFolder}</p>
                {projectFileCount > 0 && (
                  <span className="text-xs font-bold text-black/60">
                    {projectFileCount} files selected
                  </span>
                )}
              </div>
              <p className="mt-2 break-all text-[10px] font-bold text-black/45">
                {workspacePath}
              </p>
            </div>
          )}
          <p className="mt-3 text-xs font-bold text-black/55">
            BuildMyLogic's local bridge reads the exact folder path on your
            computer, so VS Code can open that workspace directly.
          </p>
        </section>

        {projectReview && (
          <ProjectReviewCard
            review={projectReview}
            onClose={() => setProjectReview(null)}
          />
        )}
        {review && (
          <section className="rounded-2xl border-2 border-primary bg-primary-soft p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-black">
                <Sparkles className="h-4 w-4 text-primary" /> Session review
              </h2>
              <button type="button" onClick={() => setReview(null)}>
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm font-black">{review.feedback}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-white p-4">
                <p className="text-[10px] font-black uppercase">Next action</p>
                <p className="mt-1 text-sm font-black">{review.nextStep}</p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-[10px] font-black uppercase">
                  Skill evidence
                </p>
                <p className="mt-1 text-sm font-black">{review.skillBoost}</p>
              </div>
            </div>
          </section>
        )}

        <section className="card-surface p-5">
          <h2 className="text-lg font-black">Observed project evidence</h2>
          <p className="text-sm">
            Browser countdown is a planning timer, not measured active work.
            Extension v0.4.1 does not track AFK/idle or active coding time.
            Earlier timing evidence, if present, is historical.
          </p>
          <p className="text-sm">
            Expected:{" "}
            {remoteState?.expected_duration_ms
              ? Math.round(remoteState.expected_duration_ms / 60000) + " min"
              : "not assigned"}
            . Observed active time:{" "}
            {remoteState?.timing?.quality === "extension-observed"
              ? (remoteState.timing.active_ms / 60000).toFixed(1) +
                " min (estimate)"
              : "unavailable"}
            . Time alone never establishes weakness or skill.
          </p>
          <p className="text-sm">
            Inspected files:{" "}
            {remoteState?.project_context?.inspected_files.join(", ") ||
              "None. Folder selection alone does not inspect project contents."}
          </p>
          <p className="text-sm">{remoteState?.project_context?.summary}</p>
        </section>
        <section className="card-surface p-5">
          <h2 className="text-lg font-black">Close the session</h2>
          <p className="mt-1 text-sm font-semibold">
            Write what you actually built. BuildMyLogic keeps this as your
            learning history.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="I wired the form to the API but validation is still broken…"
            className="mt-3 w-full rounded-xl border border-black/15 bg-white p-3 text-sm font-semibold outline-none focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={finish}
              disabled={saving || !activeMission}
              className="btn-base btn-primary-solid"
            >
              <Timer className="h-4 w-4" />
              {saving ? "Reviewing…" : `Log ${elapsed} min & get feedback`}
            </button>
            <button
              type="button"
              onClick={completeMission}
              disabled={!activeMission}
              className="btn-base btn-outline"
            >
              <Check className="h-4 w-4" />
              Complete mission
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SessionTasks({
  remote,
  fallback,
  done,
  onToggle,
}: {
  remote?: RemoteCheckpoint[];
  fallback: Array<{ title: string; minutes: number }>;
  done: number[];
  onToggle: (index: number) => void;
}) {
  const evidenceTasks = remote?.length ? remote : undefined;
  const verified =
    evidenceTasks?.filter(
      (task) =>
        (task.evidence ??
          (task.status === "passed" ? "verified" : "not_verified")) ===
        "verified",
    ).length ?? done.length;
  const total = evidenceTasks?.length ?? fallback.length;
  return (
    <section id="session-tasks" className="card-surface scroll-mt-24 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black">Session Tasks</h2>
          <p className="mt-1 text-sm font-semibold">
            Work through these in order. Code can be detected automatically;
            only passing tests verify a task.
          </p>
        </div>
        <span className="text-xs font-black">
          {verified}/{total} verified
        </span>
      </div>
      {evidenceTasks && (
        <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-black/50">
          ✓ Verified · ◐ Detected · ○ Not verified
        </p>
      )}
      <div className="mt-4 space-y-2">
        {evidenceTasks
          ? evidenceTasks.map((task) => {
              const evidence =
                task.evidence ??
                (task.status === "passed" ? "verified" : "not_verified");
              return (
                <div
                  key={`${task.title}-${task.index}`}
                  className={`flex items-start gap-3 rounded-xl border p-4 ${evidence === "verified" ? "border-primary bg-primary-soft" : "border-black/10 bg-white"}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${evidence === "verified" ? "border-primary bg-primary text-white" : evidence === "detected" ? "border-primary text-primary" : "border-black/20 text-black/40"}`}
                  >
                    {evidence === "verified" ? (
                      <Check className="h-4 w-4" />
                    ) : evidence === "detected" ? (
                      "◐"
                    ) : (
                      "○"
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-sm">{task.title}</b>
                    <span className="mt-1 block text-xs font-semibold text-black/60">
                      {evidence === "verified"
                        ? "VERIFIED by passing tests"
                        : evidence === "detected"
                          ? "DETECTED from code activity · run tests to verify"
                          : "NOT VERIFIED"}
                    </span>
                  </span>
                </div>
              );
            })
          : fallback.map((task, index) => {
              const checked = done.includes(index);
              return (
                <button
                  type="button"
                  key={`${task.title}-${index}`}
                  onClick={() => onToggle(index)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${checked ? "border-primary bg-primary-soft" : "border-black/10 bg-white"}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${checked ? "border-primary bg-primary text-white" : "border-black/20"}`}
                  >
                    {checked && <Check className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-sm">{task.title}</b>
                    <span className="mt-1 block text-xs font-semibold">
                      {task.minutes} minutes
                    </span>
                  </span>
                </button>
              );
            })}
      </div>
    </section>
  );
}

function ProjectReviewCard({
  review,
  onClose,
}: {
  review: ProjectReview;
  onClose: () => void;
}) {
  const groups: [string, string[]][] = [
    ["Strengths", review.strengths],
    ["Issues", review.issues],
    ["Security", review.security],
    ["Missing", review.missing],
    ["Next steps", review.nextSteps],
  ];
  return (
    <section className="card-surface overflow-hidden">
      <div className="bg-black px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-black">
            <ShieldCheck className="h-4 w-4" /> Project Review
          </h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-black">
              {review.score === null
                ? "Not evaluated"
                : `${review.score}/100 (AI estimate)`}
            </span>
            <button type="button" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm font-black">{review.verdict}</p>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-2">
        {groups.map(([title, items]) => (
          <div
            key={title}
            className="rounded-xl border border-black/10 bg-white p-4"
          >
            <h3 className="text-sm font-black">{title}</h3>
            <ul className="mt-2 space-y-2">
              {items.length ? (
                items.map((item, i) => (
                  <li key={i} className="text-sm font-bold leading-5">
                    • {item}
                  </li>
                ))
              ) : (
                <li className="text-sm font-bold">• None reported.</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
function SessionProjectReview({
  review,
}: {
  review: NonNullable<RemoteSessionState["project_review"]>;
}) {
  const groups: [string, string[]][] = [
    ["Strengths", review.strengths],
    ["Issues", review.issues],
    ["Missing", review.missing],
    ["Next steps", review.nextSteps],
  ];
  return (
    <section className="card-surface mt-5 overflow-hidden border-2 border-primary/30">
      <div className="bg-black px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-black">
            <ShieldCheck className="h-4 w-4" /> BuildMyLogic project review
          </h2>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-black">
            {review.score === null
              ? "Not evaluated"
              : `${review.score}/100 (AI estimate)`}
          </span>
        </div>
        <p className="mt-3 text-sm font-black">{review.verdict}</p>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-4">
        {groups.map(([title, items]) => (
          <div
            key={title}
            className="rounded-xl border border-black/10 bg-white p-3"
          >
            <h3 className="text-xs font-black">{title}</h3>
            <p className="mt-2 text-xs font-bold leading-5">
              {items[0] ?? "None reported."}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
