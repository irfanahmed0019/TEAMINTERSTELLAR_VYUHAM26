import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | BuildMyLogic" },
      { name: "description", content: "How BuildMyLogic collects, uses and protects your information." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="28 October 2026"
      intro="This page explains what information BuildMyLogic collects when you use it, why, and the choices you have."
      sections={[
        {
          title: "What we collect",
          body: (
            <>
              <ul className="list-disc space-y-1 pl-5">
                <li>Google sign-in (optional): your name, email address and profile picture from your Google account. We do not get your Google password and we do not read your Gmail, Drive or other Google data.</li>
                <li>What you give the app: your profile and goals, resume text you paste or upload, your daily build schedule, your messages to the AI mentor, and your progress, skill evidence and activity log.</li>
                <li>On your device: your progress and settings are kept in your browser&apos;s local storage so the app works between visits.</li>
              </ul>
              <p>If you sign in, your progress, schedule and skill evidence can be saved to our cloud database (Supabase) so you can continue on another device.</p>
            </>
          ),
        },
        {
          title: "How the AI features use your information",
          body: (
            <p>
              To analyse your resume, plan missions and give mentor feedback, the text you submit is sent
              to an AI service (Sarvam AI) which returns a response. Please do not put passwords,
              government ID numbers or other sensitive information in your resume text or chat messages.
            </p>
          ),
        },
        {
          title: "How we use it",
          body: <p>To run the app, build your plan and missions, save your progress, and keep the service working and secure. We do not sell your personal information.</p>,
        },
        {
          title: "Cookies and local storage",
          body: (
            <p>
              The app uses local storage for your progress and a sign-in session if you use Google
              sign-in. We do not use advertising or analytics cookies, so there is no cookie consent
              banner. If that changes, we will ask for your consent first.
            </p>
          ),
        },
        {
          title: "Who we share it with",
          body: (
            <>
              <p>Only the services needed to run the app:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Google, for sign-in.</li>
                <li>Supabase, which stores saved progress for signed-in users.</li>
                <li>Sarvam AI, which processes the text you send to the AI features.</li>
                <li>Vercel, which hosts the website.</li>
              </ul>
              <p>We may also share information if the law requires it.</p>
            </>
          ),
        },
        {
          title: "How long we keep it",
          body: <p>We keep your saved progress until you ask us to delete it. Data in your browser stays until you clear it.</p>,
        },
        {
          title: "Your choices",
          body: (
            <p>
              Under India&apos;s Digital Personal Data Protection Act, 2023 you can ask what personal data
              we hold about you, ask us to correct or delete it, or withdraw your consent. Email{" "}
              <a href="mailto:irfanahammadj@gmail.com" className="underline">irfanahammadj@gmail.com</a>. You can also clear
              your browser data at any time.
            </p>
          ),
        },
        {
          title: "Children",
          body: <p>BuildMyLogic is meant for learners aged 18 and over, or younger learners with a parent or guardian&apos;s permission.</p>,
        },
        { title: "Changes", body: <p>If we change this policy we will update the date at the top of this page.</p> },
        { title: "Contact", body: <p>BuildMyLogic, <a href="mailto:irfanahammadj@gmail.com" className="underline">irfanahammadj@gmail.com</a>.</p> },
      ]}
    />
  );
}
