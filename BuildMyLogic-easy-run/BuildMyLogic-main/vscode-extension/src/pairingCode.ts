/** A short-lived one-use capability, distinct from the public session display ID. */
export function normalizePairingCode(value: string): string | null {
  if (
    value.length > 20 ||
    /[^A-Za-z2-9 -]/.test(value) ||
    /^BML-/i.test(value.trim())
  )
    return null;
  const normalized = value.trim().toUpperCase().replace(/[ -]/g, "");
  return /^[A-HJ-NP-Z2-9]{8}$/.test(normalized) ? normalized : null;
}
/** Never disclose pairing capabilities to workspace-selected or redirected sites. */
export function pairingApiOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "Choose the official BuildMyLogic website address before pairing. No code was sent.",
    );
  }
  if (
    (parsed.pathname !== "/" && parsed.pathname !== "") ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !(
      parsed.origin === "https://buildmylogicxyz.vercel.app" ||
      (parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname))
    )
  )
    throw new Error(
      "This address is not approved for pairing. No code was sent.",
    );
  return parsed.origin;
}
export type PairingClaim = { session_id: string; connection_token: string };
/** One claim only. No redirects, cookies, old session header, auto retry, or raw error echo. */
export async function claimPairingCode(
  baseUrl: string,
  value: string,
): Promise<PairingClaim> {
  const code = normalizePairingCode(value);
  if (!code)
    throw new Error(
      "Enter the 8-character pairing code from the signed-in Sessions page, not its Session ID.",
    );
  const origin = pairingApiOrigin(baseUrl);
  let response: Response;
  try {
    response = await fetch(origin + "/api/sessions/pairing/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error(
      "Could not reach secure pairing. Check your connection, then generate a new code on the website. No automatic retry was made.",
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Too many pairing attempts. Wait before generating and entering a new code."
        : "This pairing code is invalid, expired, or already used. Generate a new code on the website.",
    );
  const data = (await response.json().catch(() => null)) as {
    ok?: unknown;
    session_id?: unknown;
    connection_token?: unknown;
  } | null;
  if (
    !data ||
    data.ok !== true ||
    typeof data.session_id !== "string" ||
    !/^BML-[A-Z0-9]{5,20}$/.test(data.session_id) ||
    typeof data.connection_token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(data.connection_token)
  )
    throw new Error(
      "The website returned an invalid pairing response. Generate a new code and try again.",
    );
  return {
    session_id: data.session_id,
    connection_token: data.connection_token,
  };
}
