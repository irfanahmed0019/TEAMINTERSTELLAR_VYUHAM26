// Display-time dedupe for mentor chat transcripts.
// The mentor sometimes repeated its greeting, or asked the same question twice
// inside one reply (and across consecutive replies). This removes only those
// repeated pieces at render time: stored chat history is never rewritten here,
// and student messages always pass through untouched.

export type DedupeableMessage = {
  role: "mentor" | "student";
  text: string;
};

const GREETING_KEYS = new Set([
  "hey",
  "hii",
  "hiii",
  "hi",
  "hello",
  "hey there",
  "hi there",
  "hello there",
  "namaste",
  "good morning",
  "good afternoon",
  "good evening",
  "welcome back",
  "good to see you",
  "hey good to see you",
  "hi good to see you",
  "hello good to see you",
]);

export function normalizeSentence(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u{1f000}-\u{1faff}\u{2600}-\u{27bf}\u{2b00}-\u{2bff}\u{fe0f}\u{200d}]/gu, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CODE_FENCE = /(```[\s\S]*?(?:```|$))/g;
const SENTENCE = /[^.!?]+(?:[.!?]+(?=\s|$)|$)/g;

function cleanProseSegment(
  segment: string,
  seen: Set<string>,
  greeted: boolean,
): { text: string; greeted: boolean; meaningful: boolean } {
  const keptLines: string[] = [];
  let greetedNow = greeted;
  let meaningful = false;
  for (const line of segment.split("\n")) {
    const sentences = line.match(SENTENCE) ?? [];
    const kept: string[] = [];
    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;
      const key = normalizeSentence(sentence);
      // List markers, short interjections and emoji-only bits are never deduped.
      if (key.length < 3) {
        kept.push(sentence);
        continue;
      }
      if (GREETING_KEYS.has(key)) {
        // The greeting belongs to the first mentor message only.
        if (greetedNow) continue;
        greetedNow = true;
      }
      if (seen.has(key)) continue; // exact repeat inside this message or run
      seen.add(key);
      meaningful = true;
      kept.push(sentence);
    }
    if (kept.length) keptLines.push(kept.join(" "));
  }
  return { text: keptLines.join("\n"), greeted: greetedNow, meaningful };
}

function cleanMentorText(
  text: string,
  seen: Set<string>,
  greeted: boolean,
): { text: string; greeted: boolean; meaningful: boolean } {
  const parts = text.split(CODE_FENCE);
  const out: string[] = [];
  let greetedNow = greeted;
  let meaningful = false;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i] ?? "";
    if (i % 2 === 1) {
      out.push(part); // code fences stay verbatim
      if (part.replace(/```/g, "").trim()) meaningful = true;
      continue;
    }
    const cleaned = cleanProseSegment(part, seen, greetedNow);
    greetedNow = cleaned.greeted;
    meaningful = meaningful || cleaned.meaningful;
    if (cleaned.text.trim()) out.push(cleaned.text);
  }
  return { text: out.join("\n\n").trim(), greeted: greetedNow, meaningful };
}

// Clean a single freshly generated mentor reply before it is shown or saved:
// removes sentences repeated inside the same message only.
export function dedupeMentorText(text: string): string {
  const cleaned = cleanMentorText(text, new Set(), false);
  return cleaned.text || text;
}

// Clean a whole transcript for display. Consecutive mentor messages (no student
// reply between them) are treated as one run: content already shown in the run
// is dropped. A mentor message that becomes empty (it was entirely a repeat)
// is removed, except the very first mentor message of the chat.
export function dedupeMentorReplies<T extends DedupeableMessage>(messages: T[]): T[] {
  const result: T[] = [];
  const runSeen = new Set<string>();
  let greeted = false;
  let isFirstMentor = true;
  for (const message of messages) {
    if (message.role !== "mentor") {
      runSeen.clear();
      result.push(message);
      continue;
    }
    const messageSeen = new Set(runSeen);
    const cleaned = cleanMentorText(message.text, messageSeen, greeted);
    greeted = cleaned.greeted;
    for (const key of messageSeen) runSeen.add(key);
    const originallyMeaningful = cleanMentorText(message.text, new Set(), false).meaningful;
    // Drop the message when everything meaningful in it was a repeat (an empty
    // result, or a skeleton of list markers whose items were all duplicates).
    if (!cleaned.text || (originallyMeaningful && !cleaned.meaningful)) {
      if (isFirstMentor) {
        result.push(message); // never blank out the opening message
      }
      continue;
    }
    result.push(cleaned.text === message.text ? message : { ...message, text: cleaned.text });
    isFirstMentor = false;
  }
  return result;
}
