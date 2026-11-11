import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Code2, MessageCircle, Sparkles } from "lucide-react";
import { MentorApp } from "@/components/mentor/MentorApp";
import { MentorChat } from "@/components/mentor/MentorChat";
import { MentorHome } from "@/components/mentor/MentorHome";

export const Route = createFileRoute("/mentor")({
  head: () => ({ meta: [{ title: "AI Mentor — BuildMyLogic" }] }),
  component: MentorRoute,
});

type MentorView = "chat" | "workspace" | "classic";

const NEXT: Record<MentorView, { view: MentorView; label: string; icon: typeof Sparkles }> = {
  chat: { view: "workspace", label: "Practice workspace (C)", icon: Code2 },
  workspace: { view: "classic", label: "Classic mentor chat & Zoom", icon: MessageCircle },
  classic: { view: "chat", label: "Back to AI Mentor", icon: Sparkles },
};

function MentorRoute() {
  const [view, setView] = useState<MentorView>("chat");
  const next = NEXT[view];
  const NextIcon = next.icon;
  return (
    <>
      {view === "chat" ? <MentorHome /> : view === "workspace" ? <MentorApp /> : <MentorChat />}
      <button
        type="button"
        onClick={() => setView(next.view)}
        className="fixed bottom-24 right-4 z-40 lg:bottom-5 lg:right-5 flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-xs font-black shadow-lg transition hover:border-primary hover:text-primary"
      >
        <NextIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{next.label}</span>
      </button>
    </>
  );
}
