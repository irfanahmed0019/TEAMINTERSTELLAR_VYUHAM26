import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { MentorApp } from "@/components/mentor/MentorApp";
import { MentorChat } from "@/components/mentor/MentorChat";

export const Route = createFileRoute("/mentor")({
  head: () => ({ meta: [{ title: "AI Mentor — BuildMyLogic" }] }),
  component: MentorRoute,
});

function MentorRoute() {
  const [classic, setClassic] = useState(false);
  return (
    <>
      {classic ? <MentorChat /> : <MentorApp />}
      <button
        type="button"
        onClick={() => setClassic((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-xs font-black shadow-lg transition hover:border-primary hover:text-primary"
      >
        {classic ? <><Sparkles className="h-4 w-4" />Back to AI Mentor</> : <><MessageCircle className="h-4 w-4" />Classic mentor chat & Zoom</>}
      </button>
    </>
  );
}
