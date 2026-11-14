/** Dedicated, password-authenticated test principal. Never an email-ownership claim. */
export const SAMPLE_ACCOUNT_ID = "1d561e07-91d0-41d6-8a07-afd2c7fb8fd5";
export const SAMPLE_ACCOUNT_EMAIL = "demo@buildmylogic.invalid";
export const SAMPLE_AI_UNAVAILABLE =
  "Paid AI is disabled for the sample test account. Extension connection, local test results and progress remain available.";
export function isSampleAccount(userId: string | null | undefined): boolean {
  return userId === SAMPLE_ACCOUNT_ID;
}
export function passwordLoginEmail(input: string): string {
  const email = input.trim();
  return email.toLowerCase() === "demo@gmail.com"
    ? SAMPLE_ACCOUNT_EMAIL
    : email;
}
