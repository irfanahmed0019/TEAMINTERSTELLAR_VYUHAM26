import { EmailPasswordSignIn } from "./EmailPasswordSignIn";
import { useEffect, useState, type ReactNode } from "react";
import {
  getAuthSession,
  signInWithGoogle,
  saveLoopStateToCloud,
  switchRecoveryAccount,
  useAuth,
  useLocalCacheBlocked,
} from "@/lib/auth";
import { getLoopState, resetLoop, useLoop } from "@/lib/loop-store";
import { LOOP_STATE_UID_KEY } from "@/lib/cloud-sync-uid";
import {
  RECOVERY_OWNER_KEY,
  RETAINED_PREFIX,
  requiresAccountRecovery,
  blockSignedOutRecovery,
  canDiscardRecovery,
} from "@/lib/local-recovery";
export function AccountRecoveryBoundary({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const auth = useAuth();
  const cacheBlocked = useLocalCacheBlocked();
  const state = useLoop();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Match the server HTML on the first client render. Recovery/account checks
  // run only after mount, before any protected child is rendered.
  if (!mounted) return <main>Loading account...</main>;
  const cached = localStorage.getItem(LOOP_STATE_UID_KEY);
  const pending = localStorage.getItem(RECOVERY_OWNER_KEY);
  if (cacheBlocked) {
    return (
      <main className="mx-auto max-w-xl p-6" role="alert">
        <h1 className="text-2xl font-black">Keep this tab open</h1>
        <p className="my-4">
          This tab could not save its latest local progress. Its memory copy has
          been preserved, but it cannot safely join the current account.
          Learning and cloud saving are paused in this tab. Other tabs are not
          changed.
        </p>
        <p>
          Do not reload or close this tab: unsaved progress could be lost.
          Signing in again will not repair this storage problem. No local
          recovery copy has been cleared or added to another account.
        </p>
      </main>
    );
  }
  if (!auth) {
    if (
      !blockSignedOutRecovery(pending, cached, state, Object.keys(localStorage))
    )
      return <>{children}</>;
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-black">
          Sign in to recover local progress
        </h1>
        <p className="my-4">
          Learning pages are locked while local recovery is pending. Sign into
          the original account. No local progress has been cleared.
        </p>
        <button
          className="btn-base btn-outline mb-4"
          onClick={() => void signInWithGoogle()}
        >
          Continue with Google
        </button>
        <EmailPasswordSignIn />
      </main>
    );
  }
  const ownKey = RETAINED_PREFIX + auth.uid;
  const ownArchive = localStorage.getItem(ownKey);
  const mismatch = requiresAccountRecovery(cached, auth.uid, state);
  const ownPending = pending === auth.uid;
  const unboundPending = pending === "unbound";
  if (!mismatch && !ownPending && !unboundPending && !ownArchive)
    return <>{children}</>;
  const refresh = () => {
    setRevision(revision + 1);
    window.dispatchEvent(new Event("bml-recovery-changed"));
  };
  function exportOwn() {
    if (getAuthSession()?.uid !== auth?.uid) return;
    const raw =
      ownArchive ?? (ownPending ? JSON.stringify(getLoopState()) : null);
    if (!raw) return;
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "buildmylogic-local-recovery.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function saveOwn() {
    if (!auth || getAuthSession()?.uid !== auth.uid) return;
    setBusy(true);
    setError("");
    try {
      const snapshot = JSON.stringify(getLoopState());
      if (!(await saveLoopStateToCloud(getLoopState(), auth.uid)))
        throw Error("Cloud save did not complete.");
      if (getAuthSession()?.uid !== auth.uid) return;
      if (JSON.stringify(getLoopState()) !== snapshot)
        throw Error("Local progress changed during saving. Retry.");
      localStorage.removeItem(RECOVERY_OWNER_KEY);
      refresh();
    } catch {
      setError(
        "Could not save. Your local progress is unchanged. Retry or export it before clearing.",
      );
    } finally {
      setBusy(false);
    }
  }
  function discard() {
    if (
      !canDiscardRecovery(
        localStorage.getItem(LOOP_STATE_UID_KEY),
        localStorage.getItem(RECOVERY_OWNER_KEY),
        getAuthSession()?.uid,
        !!ownArchive,
      )
    )
      return;
    if (
      !window.confirm(
        "Permanently clear this local recovery copy? It may contain progress that never reached the cloud. Cloud records will not be deleted.",
      )
    )
      return;
    if (ownArchive) {
      if (getAuthSession()?.uid !== auth?.uid) return;
      localStorage.removeItem(ownKey);
    } else {
      resetLoop();
      localStorage.removeItem(RECOVERY_OWNER_KEY);
      localStorage.removeItem(LOOP_STATE_UID_KEY);
    }
    refresh();
  }
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-black">
        Protect local progress before continuing
      </h1>
      <p className="mt-4">
        This browser has local progress that has not been safely handed off.
        Cloud saving and the learning pages are paused. No new backup copies are
        being created.
      </p>
      {unboundPending || (!cached && mismatch) ? (
        <p className="mt-4">
          This older local copy has no verified owner. It cannot be viewed,
          exported or added to this account. You may explicitly clear this
          unassigned local copy to start fresh. Any unsaved work will be
          permanently lost; canceling preserves it. Cloud records are not
          deleted.
        </p>
      ) : mismatch ? (
        <p className="mt-4">
          Sign back into the account that used this browser to recover its
          progress. For privacy, another account cannot view, export or clear
          it.
        </p>
      ) : (
        <>
          <p className="mt-4">
            You can export your recovery copy. Check the downloaded file before
            choosing to clear it.
            {ownPending
              ? " Or explicitly save this local version to your cloud account, replacing its current saved learner state."
              : ""}
          </p>
          <button className="btn-base btn-outline mt-4" onClick={exportOwn}>
            Export my recovery copy
          </button>
          {ownPending && !ownArchive ? (
            <button
              disabled={busy}
              className="btn-base btn-primary mt-4"
              onClick={() => void saveOwn()}
            >
              Save my local version to cloud
            </button>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="mt-3">
          {error}
        </p>
      ) : null}
      {canDiscardRecovery(cached, pending, auth.uid, !!ownArchive) ? (
        <button
          disabled={busy}
          className="btn-base btn-outline mt-4"
          onClick={discard}
        >
          Clear local recovery copy
        </button>
      ) : null}
      <p className="mt-4 text-sm">
        Use the button below to return to sign-in without clearing local
        progress. No cloud records are removed by this screen.
      </p>
      <button
        className="btn-base btn-outline mt-4"
        onClick={() => void switchRecoveryAccount()}
      >
        Switch account without clearing local recovery
      </button>
    </main>
  );
}
