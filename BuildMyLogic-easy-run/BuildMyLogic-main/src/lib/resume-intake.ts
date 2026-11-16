export type ResumeClaims = {
  languages: string[];
  frameworks: string[];
  tools: string[];
  projects: Array<{ name: string; complexity: string; technologies: string[] }>;
  experience: string;
  competencyClaims: string[];
  provenance: "resume_claims_unverified";
};
const short = (v: unknown, max = 300) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const strings = (v: unknown) =>
  Array.isArray(v)
    ? v
        .slice(0, 12)
        .map((x) => short(x, 100))
        .filter(Boolean)
    : [];
export function normalizeResumeAnalysis(raw: unknown) {
  if (!raw || typeof raw !== "object")
    throw new Error(
      "Resume analysis returned an invalid result. Try again or continue without a resume.",
    );
  const r = raw as Record<string, unknown>;
  const summary = short(r["summary"], 1200);
  if (!summary)
    throw new Error(
      "No usable resume summary was returned. Try again or paste the resume text.",
    );
  const levels = ["beginner", "intermediate", "advanced"] as const;
  const technologies = (
    Array.isArray(r["technologies"]) ? r["technologies"] : []
  )
    .slice(0, 10)
    .flatMap((x) => {
      if (!x || typeof x !== "object") return [];
      const name = short(x.name, 100);
      const level = levels.includes(x.level)
        ? (x.level as (typeof levels)[number])
        : "beginner";
      return name ? [{ name, level }] : [];
    });
  const c =
    r["claims"] && typeof r["claims"] === "object"
      ? (r["claims"] as Record<string, unknown>)
      : r;
  const claims: ResumeClaims = {
    languages: strings(c["languages"]),
    frameworks: strings(c["frameworks"]),
    tools: strings(c["tools"]),
    projects: (Array.isArray(c["projects"]) ? c["projects"] : [])
      .slice(0, 8)
      .flatMap((x) =>
        x && typeof x === "object" && short(x.name)
          ? [
              {
                name: short(x.name),
                complexity: short(x.complexity),
                technologies: strings(x.technologies),
              },
            ]
          : [],
      ),
    experience: short(c["experience"], 1000),
    competencyClaims: strings(c["competencyClaims"]),
    provenance: "resume_claims_unverified",
  };
  return {
    name: short(r["name"], 120),
    summary,
    technologies,
    experience: claims.experience || "Not stated",
    claims,
  };
}
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export function validateResumeFile(file: { name: string; size: number }) {
  if (file.size > MAX_RESUME_BYTES)
    throw new Error("Choose a resume under 5 MB, or paste its text.");
  if (!/\.(pdf|docx|txt)$/i.test(file.name))
    throw new Error(
      "Use a PDF, DOCX or TXT file. You can also paste the text.",
    );
}
