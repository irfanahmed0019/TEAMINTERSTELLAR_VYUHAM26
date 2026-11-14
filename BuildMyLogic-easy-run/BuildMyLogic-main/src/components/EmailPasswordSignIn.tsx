import { useState, type FormEvent } from "react";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { authenticateWithPassword } from "@/lib/email-auth";
import { isDemoPreviewIdentifier } from "@/lib/demo-preview";

export function EmailPasswordSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (isDemoPreviewIdentifier(email)) {
      // Public preview only: never send or persist the supplied password.
      setPassword("");
      window.location.assign("/demo");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await authenticateWithPassword(supabase, email, password);
      // Existing auth state listener + fail-closed CloudSync restore the same account.
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setPassword("");
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-5 w-full space-y-3 text-left"
      aria-label="Email and password sign-in"
    >
      <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or sign in with email
        <span className="h-px flex-1 bg-border" />
      </div>
      <div>
        <label
          htmlFor="signin-email"
          className="mb-1 block text-xs font-semibold"
        >
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={busy}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label
          htmlFor="signin-password"
          className="mb-1 block text-xs font-semibold"
        >
          BuildMyLogic password
        </label>
        <input
          id="signin-password"
          type="password"
          name="password"
          autoComplete="current-password"
          required={!isDemoPreviewIdentifier(email)}
          disabled={busy}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="btn-base btn-primary-solid w-full gap-2 py-3 text-sm font-bold"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}{" "}
        {busy ? "Signing in..." : "Sign in with email"}
      </button>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-xs leading-5 text-destructive"
        >
          {error}
        </p>
      )}
      {isDemoPreviewIdentifier(email) && (
        <p className="rounded-xl bg-primary/10 p-3 text-xs leading-5">
          Public demo preview: any password or no password opens sample data
          only. It is not an authenticated account. Your password is not sent or
          saved.
        </p>
      )}
      <p className="text-center text-[11px] leading-5 text-muted-foreground">
        Use an existing email-and-password account. Joined with Google? Keep
        using Google. Do not enter your Google password here.
      </p>
    </form>
  );
}
