import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Mic, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/videos")({ head: () => ({ meta: [{ title: "Videos — BuildMyLogic" }] }), component: Videos });

// Python for Beginners - Full Course (freeCodeCamp.org on YouTube)
const VIDEO_ID = "rfscVS0vtbw";
// Presence rules. The Vibe reference (MIT) only reports "face count" at about 3 checks a
// second and does not define pause/resume/restart times, so these values are ours.
const CHECKS_PER_SECOND = 3;
const PAUSE_AFTER_MS = 2000; // no face for this long -> pause
const RESTART_AFTER_MS = 30000; // away longer than this -> restart from the beginning

type Phase = "idle" | "starting" | "watching" | "denied" | "error";
type YTPlayer = { playVideo(): void; pauseVideo(): void; seekTo(s: number, a: boolean): void; destroy(): void };
type YTApi = { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
declare global { interface Window { YT?: YTApi; onYouTubeIframeAPIReady?: () => void } }

function loadYouTube(): Promise<YTApi> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT as YTApi); };
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api"; s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
    }
  });
}

function Videos() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("Camera is off");
  const [message, setMessage] = useState("");
  const [micOn, setMicOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerHost = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const detectorRef = useRef<{ detectForVideo(v: HTMLVideoElement, t: number): { detections: unknown[] }; close(): void } | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectorRef.current?.close(); detectorRef.current = null;
    playerRef.current?.pauseVideo();
    setMicOn(false);
  }, []);
  useEffect(() => () => { stop(); playerRef.current?.destroy(); }, [stop]);

  async function start() {
    setPhase("starting"); setMessage("");
    try {
      // The browser asks for camera and microphone permission here.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      streamRef.current = stream;
      setMicOn(stream.getAudioTracks().some((t) => t.readyState === "live"));
      const video = videoRef.current;
      if (video) { video.srcObject = stream; await video.play().catch(() => undefined); }
      setStatus("Loading face check on this device...");
      const withTimeout = <T,>(p: Promise<T>, label: string) => Promise.race([p, new Promise<T>((_, rej) => window.setTimeout(() => rej(new Error(label)), 25000))]);
      setStatus("Loading video player...");
      const yt = await withTimeout(loadYouTube(), "youtube");
      setStatus("Loading face check on this device...");
      const { FaceDetector, FilesetResolver } = await withTimeout(import("@mediapipe/tasks-vision"), "mediapipe-import");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
      const detector = await withTimeout(FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/mediapipe/face.tflite" },
        runningMode: "VIDEO",
      }), "face-model");
      detectorRef.current = detector;
      const host = playerHost.current as HTMLDivElement;
      host.innerHTML = "<div></div>";
      let ready = false;
      playerRef.current = new yt.Player(host.firstElementChild as HTMLElement, {
        videoId: VIDEO_ID, width: "100%", height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 1 },
        events: { onReady: () => { ready = true; } },
      });
      setPhase("watching"); setStatus("Looking for you...");
      // Presence loop. Frames stay in this tab: nothing is recorded, saved or uploaded.
      let lastSeen = Date.now();
      let absentSince: number | null = null;
      let paused = false;
      let started = false;
      timerRef.current = window.setInterval(() => {
        const v = videoRef.current;
        if (!v || v.readyState < 2 || !ready) return;
        const now = Date.now();
        const present = detector.detectForVideo(v, performance.now()).detections.length > 0;
        if (present) {
          lastSeen = now;
          if (!started) { started = true; playerRef.current?.playVideo(); setStatus("Watching. Video is playing."); }
          else if (paused) {
            const away = absentSince ? now - absentSince : 0;
            paused = false;
            if (away > RESTART_AFTER_MS) { playerRef.current?.seekTo(0, true); setStatus(`You were away ${Math.round(away / 1000)}s. Restarted from the beginning.`); }
            else setStatus(`Welcome back. Resumed after ${Math.round(away / 1000)}s.`);
            playerRef.current?.playVideo();
            absentSince = null;
          }
        } else if (started && !paused && now - lastSeen >= PAUSE_AFTER_MS) {
          paused = true; absentSince = lastSeen;
          playerRef.current?.pauseVideo();
          setStatus("Paused. Come back in front of the camera to continue.");
        }
      }, 1000 / CHECKS_PER_SECOND);
    } catch (e) {
      stop();
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") { setPhase("denied"); setMessage("Camera or microphone access was blocked. Allow both for this site in your browser settings, then try again."); }
      else if (name === "NotFoundError") { setPhase("error"); setMessage("No camera or microphone was found on this device."); }
      else { setPhase("error"); setMessage(`Could not start the camera check (${(e as Error)?.message || name || "unknown"}). Please try again.`); }
    }
  }

  function end() { stop(); playerRef.current?.destroy(); playerRef.current = null; if (playerHost.current) playerHost.current.innerHTML = ""; setPhase("idle"); setStatus("Camera is off"); }
  const active = phase === "watching" || phase === "starting";

  return (
    <AppShell crumb="Learn" title="Python video" subtitle="Watch with your camera on. The video waits for you." wide>
      <div className="mx-auto w-full max-w-3xl space-y-3 p-3 sm:p-5">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
          <div ref={playerHost} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
          {!active && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center text-white">
            <p className="text-sm font-bold">Python for Beginners - Full Course</p>
            <p className="max-w-sm text-xs opacity-80">Tap start and allow camera and microphone. The video pauses when you move away.</p>
            <button type="button" onClick={() => void start()} className="btn-base btn-primary-solid text-sm font-bold">Start video</button>
          </div>}
          {phase === "starting" && <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm font-bold text-white">Starting camera...</div>}
        </div>
        {message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{message}</p>}
        <div className="flex items-center gap-3 rounded-2xl border p-3">
          <video ref={videoRef} muted playsInline aria-label="Your camera" className={`h-16 w-20 shrink-0 rounded-lg bg-black object-cover -scale-x-100 ${active ? "" : "hidden"}`} />
          <div className="min-w-0 flex-1">
            <p data-testid="presence-status" className="text-sm font-black">{status}</p>
            <p className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground"><span className="flex items-center gap-1"><Camera className="h-3 w-3" />{phase === "watching" ? "on" : "off"}</span><span className="flex items-center gap-1"><Mic className="h-3 w-3" />mic {micOn ? "allowed, not used" : "off"}</span></p>
          </div>
          {phase === "watching" && <button type="button" onClick={end} className="btn-base btn-outline text-xs">Stop</button>}
        </div>
        <p className="flex items-start gap-2 text-[11px] font-semibold text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Face check runs on your device only. Nothing is recorded or uploaded. The microphone is requested but not used: no audio is listened to, analysed or saved. This only checks that a face is in view, not attention. Pauses after 2s away, resumes if you return within 30s, restarts the video after longer.</p>
      </div>
    </AppShell>
  );
}
