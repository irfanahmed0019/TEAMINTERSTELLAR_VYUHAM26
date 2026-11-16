import { sectionQuestion } from "@/lib/video-section-questions";
import { useAuth, getAuthSession } from "@/lib/auth";
import { useCloudHydrated } from "@/lib/cloud-sync";
import { getLoopState, setLoopState } from "@/lib/loop-store";
import {
  checkpointEnd,
  completedCheckpoint,
  videoQuestion,
} from "@/lib/video-learning";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  absenceAction,
  canCreditEnded,
  initialVideoProgress,
  sampleVideo,
} from "@/lib/video-checkpoint";

// Presence rules. The Vibe reference (MIT) only reports "face count" at about 3 checks a
// second and does not define pause/resume/restart times, so these values are ours.
const CHECKS_PER_SECOND = 3;
type Phase = "idle" | "starting" | "watching" | "denied" | "error";
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, a: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};
type YTApi = { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTube(): Promise<YTApi> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT as YTApi);
    };
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
}

/** Local presence detection with account-scoped question checkpoint recovery. */
export function CameraVideo({
  videoId,
  title,
  topicId = "python-foundations",
}: {
  videoId: string;
  title: string;
  topicId?: string;
}) {
  const auth = useAuth();
  const hydrated = useCloudHydrated(auth?.uid);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("Camera is off");
  const [message, setMessage] = useState("");
  const [sectionInfo, setSectionInfo] = useState(
    "Every video has 120-second sections and a question gate.",
  );
  const [pending, setPending] = useState<number | null>(null);
  const pendingRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [mode, setMode] = useState<"camera" | "self_reported">("camera");
  const progressRef = useRef(initialVideoProgress());
  const completedRef = useRef(0);
  const completedEndRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null),
    playerHost = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null),
    streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const epoch = useRef(0);
  const stop = useCallback(() => {
    epoch.current++;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    playerRef.current?.pauseVideo();
  }, []);
  useEffect(
    () => () => {
      stop();
      playerRef.current?.destroy();
    },
    [stop, videoId, auth?.uid],
  );
  useEffect(() => {
    stop();
    playerRef.current?.destroy();
    playerRef.current = null;
    pendingRef.current = null;
    setPending(null);
    setPhase("idle");
    setStatus("Camera is off");
  }, [videoId, auth?.uid, stop]);
  async function start(selectedMode: "camera" | "self_reported") {
    if (!auth || !hydrated) {
      setMessage("Wait for your signed-in account to finish loading.");
      return;
    }
    stop();
    playerRef.current?.destroy();
    playerRef.current = null;
    const token = epoch.current;
    const ownerId = auth.uid;
    setMode(selectedMode);
    setPhase("starting");
    setMessage("");
    setFeedback("");
    const saved = getLoopState().videoProgress?.[videoId];
    const savedCount =
      saved?.ownerId === ownerId ? completedCheckpoint(saved) : 0;
    completedRef.current = savedCount;
    progressRef.current = {
      watched: savedCount * 120,
      position: savedCount * 120,
      sampledAt: null,
    };
    pendingRef.current = null;
    setPending(null);
    try {
      let detect: (() => Promise<boolean>) | null = null;
      const timeout = <T,>(p: Promise<T>, label: string) =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            window.setTimeout(() => reject(new Error(label)), 25000),
          ),
        ]);
      if (selectedMode === "camera") {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        if (epoch.current !== token) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("Loading local face check...");
        const faceapi = await timeout(
          import("@vladmandic/face-api"),
          "Face check unavailable",
        );
        await timeout(
          faceapi.nets.tinyFaceDetector.loadFromUri("/face-model"),
          "Face model unavailable",
        );
        const opts = new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.4,
        });
        detect = async () =>
          Boolean(
            videoRef.current &&
            (await faceapi.detectSingleFace(videoRef.current, opts)),
          );
      }
      const yt = await timeout(loadYouTube(), "Video player unavailable");
      if (epoch.current !== token) return;
      const host = playerHost.current;
      if (!host) throw new Error("Video host unavailable");
      host.innerHTML = "<div></div>";
      let ready = false,
        started = false,
        paused = false,
        rewound = false,
        busy = false,
        lastSeen = Date.now();
      playerRef.current = new yt.Player(host.firstElementChild as HTMLElement, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, controls: 1 },
        events: {
          onReady: () => {
            ready = true;
            const duration = playerRef.current?.getDuration() ?? 0;
            const end = Math.min(
              savedCount * 120,
              duration || savedCount * 120,
            );
            completedEndRef.current = end;
            progressRef.current = {
              watched: end,
              position: end,
              sampledAt: null,
            };
            playerRef.current?.seekTo(end, true);
          },
        },
      });
      setPhase("watching");
      setStatus(
        selectedMode === "camera"
          ? "Looking for your face..."
          : "Camera-free mode: playback presence is self-reported, not measured.",
      );
      timerRef.current = window.setInterval(async () => {
        const player = playerRef.current;
        if (!ready || !player || busy || epoch.current !== token) return;
        if (getAuthSession()?.uid !== ownerId) {
          stop();
          return;
        }
        if (document.hidden || pendingRef.current !== null) {
          player.pauseVideo();
          paused = true;
          progressRef.current = {
            ...progressRef.current,
            sampledAt: Date.now(),
          };
          return;
        }
        busy = true;
        let present: boolean;
        try {
          present = detect ? await detect() : true;
        } catch {
          player.pauseVideo();
          paused = true;
          lastSeen = Date.now();
          progressRef.current = { ...progressRef.current, sampledAt: lastSeen };
          setStatus(
            "Face check interrupted. No absence or watch credit recorded.",
          );
          busy = false;
          return;
        }
        busy = false;
        if (epoch.current !== token) return;
        const now = Date.now(),
          duration = player.getDuration();
        if (present) {
          lastSeen = now;
          rewound = false;
          if (!started || paused) {
            started = true;
            paused = false;
            player.seekTo(progressRef.current.position, true);
            progressRef.current = { ...progressRef.current, sampledAt: now };
            player.playVideo();
          }
          const position = player.getCurrentTime();
          const playerState = player.getPlayerState();
          const result = sampleVideo(
            progressRef.current,
            position,
            now,
            playerState === 1 ||
              canCreditEnded(
                progressRef.current,
                position,
                duration,
                playerState,
                now,
              ),
            true,
          );
          progressRef.current = result.state;
          if (result.seek !== null) {
            player.seekTo(result.seek, true);
            setStatus(
              "Watch the unfinished section first. Forward skipping is blocked.",
            );
          }
          const end = checkpointEnd(completedRef.current, duration);
          if (
            duration > 0 &&
            completedEndRef.current < duration &&
            result.state.watched >= end - 0.2
          ) {
            player.pauseVideo();
            player.seekTo(end, true);
            progressRef.current = {
              ...progressRef.current,
              watched: end,
              position: end,
              sampledAt: null,
            };
            pendingRef.current = completedRef.current;
            setPending(completedRef.current);
            setFeedback("");
            paused = true;
            setStatus("Section finished. Answer the checkpoint to continue.");
          }
          const count = duration > 0 ? Math.ceil(duration / 120) : "?";
          setSectionInfo(
            `${completedRef.current} of ${count} sections completed · 120-second sections · ${selectedMode === "camera" ? "camera presence" : "self-reported presence"}`,
          );
        } else {
          // No absent time is added, including the four-second grace period.
          if (
            started &&
            absenceAction(now - lastSeen, { paused, rewound }) === "replay"
          ) {
            paused = true;
            rewound = true;
            player.pauseVideo();
            progressRef.current = {
              watched: completedEndRef.current,
              position: completedEndRef.current,
              sampledAt: null,
            };
            player.seekTo(completedEndRef.current, true);
            setStatus(
              "Paused after more than four seconds absent. Return to resume from your last completed question checkpoint.",
            );
          }
          if (!started || paused) player.pauseVideo();
          progressRef.current = { ...progressRef.current, sampledAt: now };
        }
      }, 1000 / CHECKS_PER_SECOND);
    } catch (e) {
      if (epoch.current !== token) return;
      stop();
      setPhase(
        (e as DOMException)?.name === "NotAllowedError" ? "denied" : "error",
      );
      setMessage(
        `${(e as Error)?.message || "Unable to start"}. Retry with camera, or choose camera-free learning.`,
      );
    }
  }
  function answer(choice: number) {
    const section = pendingRef.current;
    if (section === null || !auth || getAuthSession()?.uid !== auth.uid) return;
    const activeQuestion =
      sectionQuestion(videoId, section) ?? videoQuestion(topicId, section);
    const correct = choice === activeQuestion.answer;
    const ownerId = auth.uid;
    setLoopState((prev) => {
      const old = prev.videoProgress?.[videoId];
      const safe = old?.ownerId === ownerId ? old : undefined;
      return {
        ...prev,
        videoProgress: {
          ...prev.videoProgress,
          [videoId]: {
            ownerId,
            completed: correct
              ? Array.from(new Set([...(safe?.completed ?? []), section + 1]))
              : (safe?.completed ?? []),
            results: [
              ...(safe?.results ?? []),
              { section, correct, at: Date.now(), mode },
            ].slice(-300),
            updatedAt: Date.now(),
          },
        },
      };
    });
    setFeedback(
      `${correct ? "Correct." : "Try again."} ${activeQuestion.explanation}`,
    );
    if (correct) {
      completedRef.current = section + 1;
      completedEndRef.current = progressRef.current.position;
      pendingRef.current = null;
      setPending(null);
      setStatus("Checkpoint saved. Continue from the completed section.");
    }
  }
  function end() {
    stop();
    playerRef.current?.destroy();
    playerRef.current = null;
    setPhase("idle");
    setStatus("Stopped. Completed question checkpoints are saved.");
  }
  const active = phase === "watching" || phase === "starting";
  const groundedQuestion =
    pending === null ? null : sectionQuestion(videoId, pending);
  const question =
    pending === null
      ? null
      : (groundedQuestion ?? videoQuestion(topicId, pending));
  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        <div
          ref={playerHost}
          className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full"
        />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center text-white">
            <p className="text-sm font-bold">{title}</p>
            <button
              type="button"
              disabled={!hydrated || !auth}
              onClick={() => void start("camera")}
              className="btn-base btn-primary-solid"
            >
              Start with camera
            </button>
            <button
              type="button"
              disabled={!hydrated || !auth}
              onClick={() => void start("self_reported")}
              className="rounded-lg border border-white/50 px-3 py-2 text-xs"
            >
              Learn without camera
            </button>
          </div>
        )}
      </div>
      <p data-testid="video-section" className="text-xs text-muted-foreground">
        {sectionInfo}
      </p>
      <p
        role="status"
        aria-live="polite"
        data-testid="presence-status"
        className="text-sm font-semibold"
      >
        {status}
      </p>
      {message && (
        <p role="alert" className="rounded-xl border p-3 text-sm text-red-700">
          {message}
        </p>
      )}
      {question && (
        <section
          aria-label="Section checkpoint"
          className="rounded-xl border border-primary/30 p-4"
        >
          <h3 className="font-bold">
            Section {(pending ?? 0) + 1}{" "}
            {groundedQuestion
              ? "caption-based checkpoint"
              : "topic review checkpoint"}
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            {groundedQuestion
              ? "Question based on this section's English auto-captions, which may contain transcription errors. This checks one answer, not independent coding mastery."
              : "No reviewed section question is available here. This is an authored topic review, not a claim about this exact video segment. Longer videos may repeat topic checks."}
          </p>
          {groundedQuestion ? (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary>Caption source and timestamp</summary>
              <blockquote className="my-2">
                {groundedQuestion.provenance.quote}
              </blockquote>
              <a
                className="underline"
                href={groundedQuestion.provenance.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                YouTube transcript, caption starts at{" "}
                {Math.floor(groundedQuestion.provenance.startSeconds / 60)}:
                {String(groundedQuestion.provenance.startSeconds % 60).padStart(
                  2,
                  "0",
                )}{" "}
                (auto-generated)
              </a>
              <p>
                Caption timing is from the transcript panel, not independently
                audio-verified.
              </p>
            </details>
          ) : null}
          <p className="my-3 text-sm">{question.prompt}</p>
          <div className="grid gap-2">
            {question.options.map((o, i) => (
              <button
                key={i}
                type="button"
                className="rounded-xl border p-3 text-left text-sm hover:border-primary"
                onClick={() => answer(i)}
              >
                {o}
              </button>
            ))}
          </div>
        </section>
      )}
      {feedback && (
        <p role="status" className="rounded-xl bg-muted p-3 text-sm">
          {feedback}
        </p>
      )}
      <div className="flex items-center gap-3">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Your camera, processed locally"
          className={`h-16 w-20 rounded-lg bg-black object-cover -scale-x-100 ${active && mode === "camera" ? "" : "hidden"}`}
        />
        {active && mode === "camera" && (
          <button
            type="button"
            onClick={() => void start("self_reported")}
            className="btn-base btn-outline text-xs"
          >
            Switch to camera-free learning
          </button>
        )}
        {active && (
          <button
            type="button"
            onClick={end}
            className="btn-base btn-outline text-xs"
          >
            Stop
          </button>
        )}
      </div>
      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mt-1 h-4 w-4 shrink-0" />
        Camera consent is optional. Face checks run locally about three times
        per second. No footage is recorded or uploaded, and the microphone is
        never requested. Face presence does not prove attention or
        understanding. More than four continuous seconds absent pauses playback
        and returns to the last completed question checkpoint. Camera-free mode
        uses self-reported presence. Hidden tabs pause. Completed sections and
        question results are saved to your signed-in learner state; watching
        alone never raises practical competency.
      </p>
    </div>
  );
}
