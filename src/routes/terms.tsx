import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use | BuildMyLogic" },
      { name: "description", content: "The terms for using BuildMyLogic." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="28 October 2026"
      intro="By using BuildMyLogic you agree to these terms."
      sections={[
        { title: "What BuildMyLogic is", body: <p>BuildMyLogic is a learning tool that helps you plan and build projects, with an AI mentor that gives hints and feedback. It is provided free of charge for learning.</p> },
        { title: "AI guidance", body: <p>The AI mentor can be wrong. Check its suggestions before you rely on them, especially for security, legal or financial decisions. It is guidance, not professional advice.</p> },
        { title: "Your account and content", body: <p>You are responsible for what you put into the app and for keeping your Google account secure. You keep ownership of your content and give us permission to store and process it to run the app for you. Do not submit content you have no right to use, or anything unlawful or harmful.</p> },
        { title: "Fair use", body: <p>Do not misuse the service, try to break into it, overload it, or use it to attack others or break the law. We may limit or stop access if the service is being abused.</p> },
        { title: "Availability", body: <p>We try to keep BuildMyLogic running, but we do not promise it will always be available or error free. Features may change or be removed.</p> },
        { title: "Liability", body: <p>To the extent the law allows, BuildMyLogic is provided as is, and we are not liable for losses from using it or from it being unavailable. Nothing here limits your rights under Indian law.</p> },
        { title: "Privacy", body: <p>See our <a href="/privacy" className="underline">Privacy Policy</a> for how your information is used.</p> },
        { title: "Governing law and contact", body: <p>These terms are governed by the laws of India. Questions: <a href="mailto:irfanahammadj@gmail.com" className="underline">irfanahammadj@gmail.com</a>.</p> },
      ]}
    />
  );
}
