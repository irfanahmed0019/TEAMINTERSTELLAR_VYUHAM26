import { isPublicDemo } from "./demo-mode";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LoopState } from "./loop-types";
import {
  getAuthSession,
  loadLoopStateFromCloud,
  saveLoopStateToCloud,
  useAuth,
} from "./auth";
import { restoreCloudState } from "./cloud-restore";
import {
  getLoopState,
  normalizeLoopState,
  setLoopState,
  useLoop,
} from "./loop-store";

// Which signed-in uid has finished loading its saved state from the cloud.
let hydratedUidStore: string | null = null;
const hydrationListeners = new Set<() => void>();
function setHydrated(uid: string | null) {
  if (hydratedUidStore === uid) return;
  hydratedUidStore = uid;
  hydrationListeners.forEach((l) => l());
}
/** True once the signed-in learner's saved plan has been restored (or none exists). */
export function useCloudHydrated(uid: string | null | undefined): boolean {
  return useSyncExternalStore(
    (l) => {
      hydrationListeners.add(l);
      return () => hydrationListeners.delete(l);
    },
    () => !!uid && hydratedUidStore === uid,
    () => false,
  );
}

export function CloudSync() {
  const path = useLocation({ select: (location) => location.pathname });
  return path === "/demo" || isPublicDemo() ? null : <AccountCloudSync />;
}

function AccountCloudSync() {
  const auth = useAuth();
  const uid = auth?.uid;
  const state = useLoop();
  const [hydratedUid, setHydratedUid] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const lastSaved = useRef("");
  const readyUid = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readyUid.current = null;
    setHydratedUid(null);
    setHydrated(null);
    setFailure(null);
    lastSaved.current = "";
    if (!uid) return;
    const current = () => !cancelled && getAuthSession()?.uid === uid;
    void restoreCloudState<LoopState>({
      read: async () => (await loadLoopStateFromCloud(uid)) as LoopState | null,
      current,
      normalize: normalizeLoopState,
      local: getLoopState,
      apply: (restored) => setLoopState(() => restored),
    })
      .then((baseline) => {
        if (!current() || baseline === null) return;
        // Baseline only, never a sign-in-triggered upload or migration.
        lastSaved.current = baseline;
        readyUid.current = uid;
        setHydratedUid(uid);
        setHydrated(uid);
      })
      .catch(() => {
        if (!current()) return;
        // Remain unhydrated: a permission/network error must never unlock autosave.
        setFailure(
          "Cloud progress could not be loaded. Your saved progress has not been replaced. Cloud saving is paused until a successful retry.",
        );
      });
    return () => {
      cancelled = true;
      readyUid.current = null;
    };
  }, [uid, retry]);

  useEffect(() => {
    if (!uid || hydratedUid !== uid || readyUid.current !== uid) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastSaved.current) return;
    const timer = window.setTimeout(() => {
      if (readyUid.current !== uid || getAuthSession()?.uid !== uid) return;
      void saveLoopStateToCloud(state, uid)
        .then((saved) => {
          if (
            saved &&
            readyUid.current === uid &&
            getAuthSession()?.uid === uid
          ) {
            lastSaved.current = serialized;
          }
        })
        .catch((error) =>
          console.error("BuildMyLogic cloud save failed", error),
        );
    }, 700);
    return () => window.clearTimeout(timer);
  }, [uid, hydratedUid, state]);

  return failure ? (
    <div
      role="alert"
      className="sticky top-4 z-[100] mx-4 mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-lg"
    >
      <p>{failure}</p>
      <button
        type="button"
        className="mt-2 font-bold underline"
        onClick={() => setRetry((n) => n + 1)}
      >
        Retry cloud restore
      </button>
    </div>
  ) : null;
}
