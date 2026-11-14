import { createConfirmedAccount } from "@/lib/email-signup";
import { useState, type FormEvent } from "react";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { authenticateWithPassword } from "@/lib/email-auth";
import { isDemoPreviewIdentifier } from "@/lib/demo-preview";

export function EmailPasswordSignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signup")
        setNotice(
          await createConfirmedAccount(
            supabase,
            email,
            password,
            confirmation,
            window.location.origin,
            async () => {
              const r = await fetch("/api/auth/signup-policy", {
                cache: "no-store",
              });
              const d = (await r.json()) as { confirmedEmailSignup?: boolean };
              return r.ok && d.confirmedEmailSignup === true;
            },
          ),
        );
      else await authenticateWithPassword(supabase, email, password);
      // Existing auth state listener + fail-closed CloudSync restore the same account.
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setPassword("");
      setConfirmation("");
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
        {mode === "signup"
          ? "create an account with email"
          : "or sign in with email"}
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
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={mode === "signup" ? 8 : undefined}
          required
          disabled={busy}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </div>
      {mode === "signup" && (
        <div>
          <label
            htmlFor="signup-confirm"
            className="mb-1 block text-xs font-semibold"
          >
            Confirm password
          </label>
          <input
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={busy}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Confirm your email before signing in. Use a new BuildMyLogic
            password, not your email or Google password. Already joined with
            Google? Keep using Google.
          </p>
        </div>
      )}
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
        {busy
          ? mode === "signup"
            ? "Creating account..."
            : "Signing in..."
          : mode === "signup"
            ? "Create account"
            : "Sign in with email"}
      </button>
      <button
        type="button"
        disabled={busy}
        className="w-full py-2 text-center text-sm font-semibold text-primary"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setPassword("");
          setConfirmation("");
          setError("");
          setNotice("");
        }}
      >
        {mode === "signin"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-primary/10 p-3 text-xs leading-5"
        >
          {notice}
        </p>
      )}
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
          Sample test account: demo@gmail.com is a login alias for the dedicated
          demo@buildmylogic.invalid test account, not a Gmail mailbox. Enter the
          saved account password. Extension testing and progress are enabled;
          paid AI is off.
        </p>
      )}
      <p className="text-center text-[11px] leading-5 text-muted-foreground">
        Email accounts require confirmation before first sign-in. Joined with
        Google? Keep using Google. Do not enter your Google password here.
      </p>
    </form>
  );
}
