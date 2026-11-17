import { createHash } from "node:crypto";
export type SurpriseBinding = {
  userId: string;
  sessionId: string;
  challengeId: string;
  taskGeneration?: number;
};
/** One owner-wide reservation, not a result. Unique PK makes parallel assignments atomic. */
export async function claimNextSurprise(
  binding: SurpriseBinding,
): Promise<boolean> {
  const url = process.env["VITE_SUPABASE_URL"]?.trim().replace(/\/$/, "");
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (
    !url ||
    !key ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      binding.userId,
    )
  )
    return false;
  const id =
    "SURPRISE-V1-" + createHash("sha256").update(binding.userId).digest("hex");
  const target = {
    ownerId: binding.userId,
    sessionId: binding.sessionId,
    challengeId: binding.challengeId,
    generation: binding.taskGeneration ?? 0,
  };
  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  const response = await fetch(
    `${url}/rest/v1/learning_sessions?on_conflict=session_id&select=session_data`,
    {
      method: "POST",
      headers: {
        ...headers,
        prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify({
        session_id: id,
        user_id: binding.userId,
        challenge_id: "surprise-slot-v1",
        title: "Private next-question reservation (not a result)",
        language: "Metadata",
        concept: "next-question eligibility",
        instructions:
          "Metadata only. No learning attempt, score or completion is represented.",
        expected_skills: [],
        status: "expired",
        attempts: 0,
        hints_used: 0,
        session_data: { recordKind: "surprise-slot-v1", ...target },
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      "Could not reserve the next-question test safely. No new task confirmed.",
    );
  let rows = await response.json();
  if (!Array.isArray(rows))
    throw new Error("Invalid next-question reservation response.");
  if (!rows.length) {
    const query = new URLSearchParams({
      session_id: "eq." + id,
      user_id: "eq." + binding.userId,
      select: "session_data",
    });
    const read = await fetch(`${url}/rest/v1/learning_sessions?${query}`, {
      headers,
    });
    if (!read.ok)
      throw new Error("Could not verify next-question reservation.");
    rows = await read.json();
  }
  const saved = Array.isArray(rows) ? rows[0]?.session_data : undefined;
  if (
    !saved ||
    saved.recordKind !== "surprise-slot-v1" ||
    saved.ownerId !== binding.userId
  )
    throw new Error("Next-question reservation owner is unverified.");
  return (
    saved.sessionId === target.sessionId &&
    saved.challengeId === target.challengeId &&
    saved.generation === target.generation
  );
}
