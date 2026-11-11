import { useEffect } from "react";

// Keeps open tabs on the current deployment. Without a service worker, a tab
// left open keeps running the JS bundle it loaded, so users could sit on an
// old build for days. We poll a no-store version endpoint; when the deployed
// version changes, we reload onto the fresh build - but only when nothing
// would be lost: no half-typed text anywhere (chat composers), no active
// camera/video session (face detection), and never twice in quick succession.
// CacheStorage entries (app-level HTTP caches) are cleared on the reload;
// localStorage, IndexedDB and cookies - saved chats, learning progress and
// sign-in - are never touched.

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RETRY_WHEN_BUSY_MS = 30 * 1000;
const MIN_RELOAD_GAP_MS = 20 * 60 * 1000;
const LAST_RELOAD_KEY = "bml:last-auto-reload";

async function clearAppCaches(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // CacheStorage unavailable or blocked - the reload still revalidates.
  }
}

function hasUnsentText(): boolean {
  for (const field of Array.from(document.querySelectorAll("textarea, input"))) {
    if (field instanceof HTMLTextAreaElement && field.value.trim()) return true;
    if (field instanceof HTMLInputElement) {
      const type = (field.getAttribute("type") || "text").toLowerCase();
      if (["text", "search", "email", "url", "tel", "number", "password"].includes(type) && field.value.trim()) {
        return true;
      }
    }
  }
  const editable = document.querySelector("[contenteditable='true'], [contenteditable='']");
  return Boolean(editable && editable.textContent?.trim());
}

function hasActiveCameraOrVideo(): boolean {
  for (const video of Array.from(document.querySelectorAll("video"))) {
    if (!video.paused && !video.ended && video.readyState > 2) return true;
  }
  return false;
}

function reloadedRecently(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(LAST_RELOAD_KEY) ?? "0");
    return Number.isFinite(last) && Date.now() - last < MIN_RELOAD_GAP_MS;
  } catch {
    return false;
  }
}

function markReloaded(): void {
  try {
    window.sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage unavailable - the version baseline still prevents repeats.
  }
}

export function AppUpdater() {
  useEffect(() => {
    let baseline: string | undefined;
    let stopped = false;
    let updatePending = false;
    let retry: number | undefined;

    async function applyUpdate() {
      if (stopped) return;
      if (hasUnsentText() || hasActiveCameraOrVideo() || reloadedRecently()) {
        // Something worth protecting is on screen - try again shortly.
        retry = window.setTimeout(() => void applyUpdate(), RETRY_WHEN_BUSY_MS);
        return;
      }
      stopped = true;
      markReloaded();
      await clearAppCaches();
      window.location.reload();
    }

    async function check() {
      if (stopped || updatePending) return;
      try {
        const res = await fetch("/api/app-version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: unknown };
        const version = typeof data.version === "string" ? data.version.trim() : "";
        if (!version || version === "dev") {
          baseline ??= version || undefined;
          return;
        }
        if (!baseline) {
          baseline = version;
          return;
        }
        if (version !== baseline) {
          updatePending = true;
          void applyUpdate();
        }
      } catch {
        // Offline hiccup - try again on the next tick.
      }
    }

    void check();
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onActive = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onActive);
    window.addEventListener("focus", onActive);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      if (retry !== undefined) window.clearTimeout(retry);
      document.removeEventListener("visibilitychange", onActive);
      window.removeEventListener("focus", onActive);
    };
  }, []);

  return null;
}
