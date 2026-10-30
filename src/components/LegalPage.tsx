import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type LegalSection = { title: string; body: ReactNode };

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <Link to="/" className="display text-[22px] font-extrabold">
        BuildMyLogic
      </Link>
      <h1 className="display mt-8 text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[42px]">
        {title}
      </h1>
      <p className="mt-3 text-[15px] leading-6 text-muted-foreground">{intro}</p>
      <p className="mt-2 text-xs text-muted-foreground">Last updated: {updated}</p>
      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="display text-xl font-bold">{s.title}</h2>
            <div className="mt-2 space-y-3 text-sm leading-7 text-foreground/80">{s.body}</div>
          </section>
        ))}
      </div>
      <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
        <Link to="/privacy" className="underline">Privacy Policy</Link> ·{" "}
        <Link to="/terms" className="underline">Terms of Use</Link> ·{" "}
        <Link to="/" className="underline">Back to BuildMyLogic</Link>
      </p>
    </div>
  );
}
