import { useState } from "react";
import { STUDY_TOPICS } from "@/lib/topic-library";
import { TopicPractice } from "@/components/learn/TopicPractice";

/** Reuses authored Python lessons and the existing real-execution practice path. */
export function PythonMentorLessons() {
  const [topicId, setTopicId] = useState("first-program");
  const topic =
    STUDY_TOPICS.find((item) => item.id === topicId) ?? STUDY_TOPICS[0]!;
  const notes = topic.notes.python;
  return (
    <section aria-label="Python guided topic practice" className="space-y-5">
      <div className="card-surface p-5">
        <h2 className="text-xl font-bold">Python guided topic practice</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Read a short lesson, edit Python code, then Run or Submit Task against
          real output checks. These are authored topic lessons, not the full
          adaptive C calculator journey. Your C journey and its history stay
          unchanged.
        </p>
        <label className="mt-4 block text-sm font-semibold">
          Python lesson
          <select
            aria-label="Python lesson"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
          >
            {STUDY_TOPICS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section aria-label="Python lesson notes" className="card-surface p-5">
        <h3 className="text-lg font-bold">{topic.title} in Python</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {notes.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <details className="mt-4 rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Study example: {notes.codeTitle}
          </summary>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs">
            {notes.code}
          </pre>
        </details>
        <p className="mt-3 text-xs text-muted-foreground">
          Selecting a lesson does not mark it complete or call AI. Run and
          Submit send only the exercise code and test inputs to the existing
          sandbox. Chat and hint requests elsewhere may use AI credits. Finite
          passes do not prove broad mastery.
        </p>
      </section>
      <TopicPractice
        key={`python:${topic.id}`}
        topicId={topic.id}
        topicTitle={topic.title}
        language="python"
        exercise={topic.exercise.python}
      />
    </section>
  );
}
