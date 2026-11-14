import { learnerStorage } from "@/lib/demo-mode";
import { useEffect, useState } from "react";
import { getAuthSession, loadLoopStateFromCloud, useAuth } from "@/lib/auth";
import { useCloudHydrated } from "@/lib/cloud-sync";
import {
  getLoopState,
  normalizeLoopState,
  setLoopState,
} from "@/lib/loop-store";
import type { LoopState } from "@/lib/loop-types";
import { makeSampleProgress } from "@/lib/sample-progress";

const backupKey = (uid: string) => `bml.sample-backup.v1:${uid}`;
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );

export function SampleProgressImport() {
  const auth = useAuth();
  const hydrated = useCloudHydrated(auth?.uid);
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasBackup, setHasBackup] = useState(
    () =>
      typeof window !== "undefined" &&
      !!getAuthSession()?.uid &&
      !!learnerStorage.getItem(backupKey(getAuthSession()!.uid)),
  );

  useEffect(() => {
    setHasBackup(!!auth?.uid && !!learnerStorage.getItem(backupKey(auth.uid)));
  }, [auth?.uid]);

  async function replace(restore: boolean) {
    const uid = auth?.uid;
    if (!uid || !hydrated || busy || getAuthSession()?.uid !== uid) return;
    setBusy(true);
    setStatus("Checking saved progress before any change...");
    const before = structuredClone(getLoopState());
    try {
      const cloud = await loadLoopStateFromCloud(uid);
      if (
        getAuthSession()?.uid !== uid ||
        stable(getLoopState()) !== stable(before)
      )
        throw new Error(
          "Progress or account changed during this check. Nothing was imported. Reload and review it first.",
        );
      if (
        cloud !== null &&
        stable(normalizeLoopState(cloud as Partial<LoopState>)) !==
          stable(before)
      )
        throw new Error(
          "Another device has different saved progress. Nothing was imported. Reload and review the latest progress first.",
        );
      let next: LoopState;
      if (restore) {
        const raw = learnerStorage.getItem(backupKey(uid));
        const saved = raw ? JSON.parse(raw) : null;
        if (saved?.uid !== uid || !saved.state)
          throw new Error(
            "No backup for this account is available in this browser.",
          );
        next = normalizeLoopState(saved.state);
      } else {
        // Store a rollback before touching current state. Storage failure aborts import.
        learnerStorage.setItem(
          `${backupKey(uid)}:snapshot:${Date.now()}`,
          JSON.stringify({ uid, backedUpAt: Date.now(), state: before }),
        );
        if (!learnerStorage.getItem(backupKey(uid)))
          learnerStorage.setItem(
            backupKey(uid),
            JSON.stringify({ uid, backedUpAt: Date.now(), state: before }),
          );
        setHasBackup(true);
        next = makeSampleProgress();
      }
      if (getAuthSession()?.uid !== uid)
        throw new Error("Account changed. No progress was replaced.");
      setLoopState(() => next);
      setConfirm(false);
      setStatus(
        restore
          ? "Backup restored locally. Waiting for cloud verification..."
          : "Labeled sample progress loaded. Waiting for cloud verification...",
      );
      await new Promise((resolve) => setTimeout(resolve, 1600));
      const saved = await loadLoopStateFromCloud(uid);
      if (getAuthSession()?.uid !== uid || stable(saved) !== stable(next))
        throw new Error(
          "Local change is present, but cloud save could not be confirmed. Keep this page open and do not repeat the import. Your backup is retained.",
        );
      setStatus(
        restore
          ? "Backup restored and cloud save verified."
          : "Sample progress saved and verified in cloud storage. Backup retained in this browser.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Import stopped. No further changes were made.",
      );
    } finally {
      setBusy(false);
    }
  }
  function downloadBackup() {
    if (!auth?.uid) return;
    const raw = learnerStorage.getItem(backupKey(auth.uid));
    if (!raw) return;
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "buildmylogic-before-sample-progress.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="card-surface p-5">
      <h3 className="text-sm font-bold">Labeled sample progress</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Replace this account's learning view with a sample Python plan, 12
        sample sessions and sample Struggle DNA. Every number and win is
        synthetic, not genuine achievement. This changes saved account progress,
        not a separate demo mode. No AI call or server session is created.
      </p>
      <p className="mt-2 text-xs">
        A private rollback copy is kept in this browser before import. Download
        it below for safekeeping. Existing separate server sessions and calendar
        events are not changed.
      </p>
      {!confirm ? (
        <button
          type="button"
          disabled={!auth || !hydrated || busy}
          className="btn-base btn-outline mt-3 w-full"
          onClick={() => setConfirm(true)}
        >
          Review sample import
        </button>
      ) : (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
          <p>
            Replace progress for {auth?.email} with clearly labeled samples?
            Your current state is backed up first. Close other editing tabs
            before continuing.
          </p>
          <button
            type="button"
            disabled={busy}
            className="btn-base btn-primary-solid mt-3 w-full"
            onClick={() => void replace(false)}
          >
            Back up and load sample progress
          </button>
          <button
            type="button"
            disabled={busy}
            className="mt-2 underline"
            onClick={() => setConfirm(false)}
          >
            Cancel
          </button>
        </div>
      )}
      {hasBackup && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <button type="button" className="underline" onClick={downloadBackup}>
            Download private backup
          </button>
          <button
            type="button"
            disabled={busy || !hydrated}
            className="underline"
            onClick={() => {
              if (
                window.confirm(
                  "Restore your pre-sample backup? This replaces current progress, including changes made since importing samples.",
                )
              )
                void replace(true);
            }}
          >
            Restore pre-sample backup
          </button>
        </div>
      )}
      {status && (
        <p role="status" className="mt-3 text-xs leading-relaxed">
          {status}
        </p>
      )}
    </section>
  );
}
