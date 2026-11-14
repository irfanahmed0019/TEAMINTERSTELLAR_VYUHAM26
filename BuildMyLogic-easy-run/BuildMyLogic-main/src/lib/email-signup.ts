/** Provider-backed confirmed-email signup. No admin identity creation or account rewriting. */
export type SignupClient = {
  auth: {
    signUp(input: {
      email: string;
      password: string;
      options: { emailRedirectTo: string };
    }): Promise<{
      data: { session: unknown };
      error: { code?: string | undefined; message: string } | null;
    }>;
    signOut(input?: { scope: "local" }): Promise<unknown>;
  };
};
export function signupError(code?: string): string {
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  )
    return "Too many signup requests. Wait a few minutes before trying again.";
  if (code === "weak_password")
    return "Choose a stronger password with at least 8 characters.";
  return "Could not create an account. If you already joined, sign in using your original method.";
}
export async function createConfirmedAccount(
  client: SignupClient | null,
  email: string,
  password: string,
  confirmation: string,
  origin: string,
  policy: () => Promise<boolean>,
): Promise<string> {
  if (!client) throw Error("Email signup is not configured on this site.");
  if (!email.trim() || !password)
    throw Error("Enter your email and a new BuildMyLogic password.");
  if (password.length < 8)
    throw Error("Use at least 8 characters for your password.");
  if (password !== confirmation) throw Error("The passwords do not match.");
  let permitted = false;
  try {
    permitted = await policy();
  } catch {
    /* Fail closed. */
  }
  if (!permitted)
    throw Error(
      "Confirmed-email signup is unavailable right now. Continue with Google or try later.",
    );
  let result;
  try {
    result = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: new URL("/auth/callback", origin).toString(),
      },
    });
  } catch {
    throw Error(
      "Could not reach the signup service. Check your connection and try again.",
    );
  }
  if (result.error) throw Error(signupError(result.error.code));
  if (result.data.session) {
    await client.auth.signOut({ scope: "local" });
    throw Error(
      "Signup did not require email confirmation. You have been signed out. Please use your original sign-in method.",
    );
  }
  return "Check your email for a confirmation link before signing in. If this address already has an account, use its original sign-in method. No account access is granted until email confirmation.";
}
