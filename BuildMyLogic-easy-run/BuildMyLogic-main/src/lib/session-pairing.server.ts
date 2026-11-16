import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
const TTL_MS = 5 * 60_000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function config() {
  const url = process.env["VITE_SUPABASE_URL"]?.trim().replace(/\/$/, "");
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !key)
    throw Error("Pairing storage is unavailable. No code was issued.");
  return { url, key };
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function normalizePairingCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 20) return null;
  if (/[^A-Za-z2-9 -]/.test(value) || /^BML-[A-Z0-9]{5}$/i.test(value.trim()))
    return null;
  const code = value.trim().toUpperCase().replace(/[ -]/g, "");
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : null;
}
function encrypt(token: string, key: string, aad: string): string {
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      createHash("sha256")
        .update("bml-pairing-v1:" + key)
        .digest(),
      iv,
    );
  cipher.setAAD(Buffer.from(aad));
  const bytes = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64url");
}
function decrypt(value: string, key: string, aad: string): string {
  const bytes = Buffer.from(value, "base64url");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256")
      .update("bml-pairing-v1:" + key)
      .digest(),
    bytes.subarray(0, 12),
  );
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    decipher.update(bytes.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
/** Dedicated DB row, never session JSON: stale session upserts cannot resurrect a used code. */
export async function createPairingCode(
  sessionId: string,
  ownerId: string,
  token: string,
  now = Date.now(),
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw Error("Start a new session before creating a pairing code.");
  const { url, key } = config();
  const code = Array.from(randomBytes(8), (b) => ALPHABET[b & 31]).join("");
  const expiresAt = new Date(now + TTL_MS).toISOString();
  const response = await fetch(`${url}/rest/v1/session_pairing_codes`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify({
      code_hash: hash(code),
      session_id: sessionId,
      owner_id: ownerId,
      token_cipher: encrypt(token, key, JSON.stringify([sessionId, ownerId])),
      expires_at: expiresAt,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw Error("Pairing storage is unavailable. No code was issued.");
  return {
    code: code.slice(0, 4) + "-" + code.slice(4),
    expires_at: expiresAt,
  };
}
/** DELETE ... RETURNING is atomic across all serverless instances: exactly one claimant wins. */
export async function claimPairingCode(
  value: unknown,
  now = Date.now(),
): Promise<{
  session_id: string;
  owner_id: string;
  connection_token: string;
} | null> {
  const code = normalizePairingCode(value);
  if (!code) return null;
  const { url, key } = config();
  const response = await fetch(
    `${url}/rest/v1/session_pairing_codes?code_hash=eq.${hash(code)}&expires_at=gt.${encodeURIComponent(new Date(now).toISOString())}&select=session_id,owner_id,token_cipher`,
    {
      method: "DELETE",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        prefer: "return=representation",
      },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok)
    throw Error("Pairing storage is unavailable. Try again with a new code.");
  const rows = (await response.json()) as {
    session_id: string;
    owner_id: string;
    token_cipher: string;
  }[];
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const row = rows[0]!;
  const token = decrypt(
    row.token_cipher,
    key,
    JSON.stringify([row.session_id, row.owner_id]),
  );
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return {
    session_id: row.session_id,
    owner_id: row.owner_id,
    connection_token: token,
  };
}
