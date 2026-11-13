import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Paperclip, Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TopicPractice } from "@/components/learn/TopicPractice";
import { aiMentorChat } from "@/lib/sarvam.functions";
import { STUDY_TOPICS, type TopicLanguage } from "@/lib/topic-library";

type ChatMessage = { role: "mentor" | "student"; text: string; at: number };

/**
 * Practice workspace for one study topic: the AI mentor chat next to the
 * mentor's basic checked task. Topic and language arrive from the
 * Learn page, so the exercise, starter code and Run/Submit checking always
 * match what the student just studied.
 */
export function MentorTopicWorkspace({
  topicId,
  language,
}: {
  topicId: string;
  language: TopicLanguage;
}) {
  const topic = STUDY_TOPICS.find((t) => t.id === topicId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (topic) {
      setMessages([
        {
          role: "mentor",
          text: `Let's practise ${topic.title} in ${language === "c" ? "C" : "Python"}. Start with the basic task - Run your code, then Submit Task and I'll check your real output. Ask me here if you're stuck.`,
          at: Date.now(),
        },
      ]);
    }
  }, [topic, language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, busy]);

  async function send() {
    const outgoing = draft.trim();
    if (!outgoing || busy || !topic) return;
    const next = [
      ...messages,
      { role: "student" as const, text: outgoing, at: Date.now() },
    ];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setChatError("");
    try {
      const result = await aiMentorChat({
        data: {
          mentorName: "BuildMyLogic Mentor",
          mentorSpecialty: `Coding help for a beginner practising ${topic.title} in ${language === "c" ? "C" : "Python"}. Explain simply, never just hand over the full answer.`,
          learnerMessage: `I am practising the topic "${topic.title}" in ${language === "c" ? "C" : "Python"}. ${outgoing}`,
          history: next
            .slice(-10)
            .map((item) => ({ role: item.role, text: item.text })),
        },
      });
      setMessages([
        ...next,
        { role: "mentor", text: result.message, at: Date.now() },
      ]);
    } catch (e) {
      setChatError(
        e instanceof Error ? e.message : "The mentor is offline right now.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!topic) {
    return (
      <AppShell
        crumb="AI Mentor"
        title="Practice workspace"
        subtitle="Pick a study topic first."
        wide
      >
        <section className="card-surface p-10 text-center">
          <p className="text-sm font-semibold">
            Open a topic in Learn, then switch to its practice workspace.
          </p>
          <Link to="/learn" className="btn-base btn-primary-solid mt-5">
            Go to Learn
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      crumb={`Learn › ${topic.title}`}
      title={`Practice workspace: ${topic.title}`}
      subtitle="Ask the mentor while you do the checked task."
      wide
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Link to="/learn" className="btn-base btn-outline">
          <ArrowLeft className="h-4 w-4" />
          Back to study topics
        </Link>
        <span className="pill bg-primary-soft font-bold text-accent-foreground">
          {language === "c" ? "C" : "Python"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Mentor chat */}
        <div className="lg:col-span-5">
          <section className="card-surface flex items-center gap-3.5 px-5 py-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[16px] font-extrabold">BuildMyLogic Mentor</p>
              <span className="pill bg-primary-soft text-accent-foreground">
                AI Mentor
              </span>
            </div>
          </section>

          <div className="mt-4 max-h-[42vh] space-y-4 overflow-y-auto pr-1 lg:max-h-[46vh]">
            {messages.map((message, i) =>
              message.role === "mentor" ? (
                <div
                  key={`${message.at}-${i}`}
                  className="max-w-[92%] rounded-2xl bg-primary-soft/70 px-5 py-4 text-[14px] font-medium leading-6"
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              ) : (
                <div key={`${message.at}-${i}`} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-[14px] font-medium leading-6 text-primary-foreground">
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="max-w-[60%] rounded-2xl bg-primary-soft/70 px-5 py-3.5 text-[13px] font-medium text-muted-foreground">
                BuildMyLogic Mentor is typing…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {chatError && (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-[12px] font-semibold text-amber-800">
              {chatError}
            </p>
          )}

          <form
            className="mt-4 flex items-center gap-2 rounded-full border border-border bg-card py-2 pl-4 pr-2 shadow-sm focus-within:border-primary"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Paperclip
              className="h-[18px] w-[18px] shrink-0 text-muted-foreground"
              aria-hidden
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Ask anything about ${topic.title}…`}
              className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-muted-foreground"
              aria-label="Message BuildMyLogic Mentor"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              aria-label="Send message"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>

        {/* Checked practice task */}
        <div className="lg:col-span-7">
          <TopicPractice
            key={`${topic.id}-${language}`}
            topicId={topic.id}
            topicTitle={topic.title}
            language={language}
            exercise={topic.exercise[language]}
          />
        </div>
      </div>
    </AppShell>
  );
}
