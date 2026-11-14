/**
 * BuildMyLogic — OAuth Callback Handler
 *
 * Safely processes redirects from Supabase Google OAuth, extracts session
 * credentials from URL hash or code exchange, and redirects learner to Dashboard.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Completing sign-in...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      void navigate({ to: "/auth/dashboard" });
      return;
    }

    let isMounted = true;
    let authStateCleanup: (() => void) | undefined;

    async function handleAuth() {
      if (!supabase) return;

      try {
        const redirectUrl = new URL(window.location.href);
        const hash = new URLSearchParams(redirectUrl.hash.replace(/^#/, ""));
        if (redirectUrl.searchParams.has("error") || hash.has("error")) {
          window.history.replaceState({}, "", redirectUrl.pathname);
          setStatus("This confirmation or sign-in link could not be used.");
          setErrorMessage(
            "It may have expired or already been used. Return to sign-in and try again.",
          );
          return;
        }
        // 1. Check if session was already established or detected from URL hash
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session && isMounted) {
          void navigate({ to: "/auth/dashboard" });
          return;
        }

        // 2. If code exists in URL (PKCE/authorization code), try to exchange
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session && isMounted) {
            void navigate({ to: "/auth/dashboard" });
            return;
          }
          if (error && isMounted) {
            setStatus("This confirmation or sign-in link could not be used.");
            setErrorMessage("Return to sign-in and try again.");
            return;
          }
        }

        // 3. Listen for auth state change (e.g., hash fragment token detection)
        const { data: authListener } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (session && isMounted) {
              void navigate({ to: "/auth/dashboard" });
            }
          },
        );
        authStateCleanup = () => authListener.subscription.unsubscribe();

        // Fallback timer: if already signed in or after brief wait, head to dashboard
        setTimeout(() => {
          if (isMounted) {
            setStatus("No completed sign-in was found.");
            setErrorMessage(
              "Confirm your email with its latest link, then return to sign-in.",
            );
          }
        }, 2500);
      } catch (err) {
        console.warn("Auth callback did not complete.");
        if (isMounted) {
          // Graceful fallback to dashboard
          setStatus("Sign-in could not be completed.");
          setErrorMessage("Return to sign-in and try again.");
        }
      }
    }

    void handleAuth();

    return () => {
      isMounted = false;
      authStateCleanup?.();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center card-surface p-8 max-w-sm w-full">
        {!errorMessage && (
          <div className="mb-4 h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        )}
        <p className="text-sm font-semibold text-foreground">{status}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Email confirmation and Google sign-in use the same secure account
          callback.
        </p>

        {errorMessage && (
          <div className="mt-4">
            <p role="alert" className="mb-4 text-xs leading-5">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => void navigate({ to: "/auth/dashboard" })}
              className="btn-base btn-primary-solid text-xs py-2 px-4"
            >
              Return to sign-in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
