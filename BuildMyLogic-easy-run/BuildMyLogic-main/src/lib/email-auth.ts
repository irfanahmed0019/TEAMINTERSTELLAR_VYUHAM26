import { passwordLoginEmail } from "./sample-account.ts";
/** No signup, reset, fake local fallback or password persistence on this path. */
export type PasswordAuthClient = {
  auth: {
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<{
      data: { session: unknown };
      error: { code?: string | undefined; message: string } | null;
    }>;
  };
};
export function passwordSignInError(code?: string): string {
  if (code === "email_not_confirmed")
    return "Confirm your email before signing in. If you normally use Google, continue with Google instead.";
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  )
    return "Too many sign-in attempts. Wait a few minutes before trying again.";
  if (code === "email_provider_disabled")
    return "Email sign-in is unavailable right now. Continue with Google instead.";
  return "Could not sign in. Check your email and BuildMyLogic password. If you joined with Google, continue with Google instead.";
}
export async function authenticateWithPassword(
  client: PasswordAuthClient | null,
  email: string,
  password: string,
): Promise<void> {
  if (!client) throw new Error("Email sign-in is not configured on this site.");
  const normalized = passwordLoginEmail(email);
  if (!normalized || !password)
    throw new Error("Enter your email and BuildMyLogic password.");
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: normalized,
      password,
    });
    if (error) throw new Error(passwordSignInError(error.code));
    if (!data.session)
      throw new Error("Sign-in did not finish. Please try again.");
  } catch (error) {
    // Never display a provider response that might reflect entered secrets.
    if (
      error instanceof Error &&
      [
        passwordSignInError(),
        passwordSignInError("email_not_confirmed"),
        passwordSignInError("over_request_rate_limit"),
        passwordSignInError("email_provider_disabled"),
        "Sign-in did not finish. Please try again.",
      ].includes(error.message)
    )
      throw error;
    throw new Error(
      "Could not reach the sign-in service. Check your connection and try again.",
    );
  }
}
