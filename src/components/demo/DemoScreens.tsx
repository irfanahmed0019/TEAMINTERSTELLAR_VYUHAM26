/**
 * Demo screens (temporary preview, owner request 2026-10-30): hardcoded,
 * reference-faithful versions of the three supplied mockups - Home,
 * Learning Path and Projects. Shown only while DEMO_MODE is true.
 * No AI calls and no real learner evidence: all content is sample data for
 * the evaluation demo. Flip DEMO_MODE to false to restore the live product.
 */
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  Brain,
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Folder,
  Globe,
  HelpCircle,
  Home,
  Images as GalleryIcon,
  LayoutGrid,
  LayoutList,
  ListChecks,
  Lock,
  Menu,
  Play,
  Search,
  Settings,
  Signal,
  Sparkles,
  Sun,
  X,
  Zap,
  Target,
} from "lucide-react";

const BLUE = "#2563eb";

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

const DEMO_NAV = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/projects", label: "Projects", icon: Briefcase },
  { to: "/learning-path", label: "Learning Path", icon: BookOpen },
  { to: "/skill-analysis", label: "Skill Analysis", icon: BarChart3 },
  { to: "/mentor", label: "AI Mentor", icon: Sparkles },
] as const;

function Logo() {
  return (
    <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="#1e3a8a" />
        <path d="M8 5v10.5L12 13l4 2.5V5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[19px] font-extrabold tracking-[-0.02em] text-gray-900">
        BuildMyLogic
      </span>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
        Demo
      </span>
    </Link>
  );
}

function DemoSidebar({ active, onNavigate }: { active: string; onNavigate?: () => void }) {
  const item = (to: string, label: string, Icon: typeof Home, key: string) => (
    <Link
      key={key}
      to={to}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] transition-colors ${
        active === key
          ? "bg-blue-50 font-semibold text-blue-600"
          : "font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <Icon className="h-[19px] w-[19px]" strokeWidth={1.9} />
      {label}
    </Link>
  );
  return (
    <nav className="flex h-full flex-col px-4 py-5">
      <div className="space-y-1.5">
        {DEMO_NAV.map(({ to, label, icon }) => item(to, label, icon, label))}
      </div>
      <div className="mt-auto space-y-1.5 border-t border-gray-100 pt-4">
        {item("/settings", "Settings", Settings, "Settings")}
        {item("/help", "Help & Support", HelpCircle, "Help")}
      </div>
    </nav>
  );
}

function DemoShell({
  active,
  children,
}: {
  active: "Home" | "Projects" | "Learning Path";
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#f8fafd] text-gray-900">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-100 bg-white/90 px-4 backdrop-blur-md sm:px-6">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setNavOpen(true)}
          className="rounded-lg border border-gray-200 p-2 text-gray-700 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Logo />
        <div className="relative mx-auto hidden w-full max-w-xl md:block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search projects, skills, or ask AI..."
            aria-label="Search"
            className="h-10 w-full rounded-full border border-gray-200 bg-gray-50 pl-11 pr-4 text-[13.5px] outline-none transition-colors placeholder:text-gray-400 focus:border-blue-300 focus:bg-white"
          />
        </div>
        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            aria-label="Notifications"
            className="relative rounded-full p-2 text-gray-700 transition-colors hover:bg-gray-100"
          >
            <Bell className="h-5 w-5" strokeWidth={1.8} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[13px] font-bold text-white">
              A
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[13.5px] font-bold">Aryan</span>
              <span className="block text-[11.5px] text-gray-500">Student</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
          </div>
        </div>
      </header>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 bg-gray-900/40"
          />
          <aside className="absolute inset-y-0 left-0 w-[264px] bg-white shadow-2xl">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setNavOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
            <DemoSidebar active={active} onNavigate={() => setNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[232px] shrink-0 border-r border-gray-100 bg-white lg:block">
          <DemoSidebar active={active} />
        </aside>
        <main className="min-w-0 flex-1 px-4 pb-16 pt-7 sm:px-7 lg:px-9">{children}</main>
      </div>
    </div>
  );
}

function QuoteBlock({ quote }: { quote: string }) {
  return (
    <div className="relative hidden max-w-[220px] shrink-0 pt-2 text-right lg:block">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-16 h-48 w-72 rounded-full bg-blue-100/60 blur-3xl"
      />
      <p className="relative text-[14px] italic leading-6 text-gray-500">“{quote}”</p>
      <p className="relative mt-1 text-[12px] text-gray-400">— BuildMyLogic</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared atoms                                                        */
/* ------------------------------------------------------------------ */

function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.05)] ${className}`}>
      {children}
    </div>
  );
}

const TECH_COLORS: Record<string, string> = {
  React: "#0ea5e9",
  "Node.js": "#16a34a",
  MongoDB: "#16a34a",
  Firebase: "#f59e0b",
  "Next.js": "#111827",
  OpenAI: "#111827",
  Python: "#2563eb",
  Plotly: "#6366f1",
  OpenWeather: "#f97316",
};

function TechChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-600">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TECH_COLORS[name] ?? "#6b7280" }} />
      {name}
    </span>
  );
}

function Donut({ pct }: { pct: number }) {
  const r = 15.5;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4.5" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={BLUE}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
      />
    </svg>
  );
}

function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-gray-100 ${className}`}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: BLUE }} />
    </div>
  );
}

function LevelPill({ level }: { level: string }) {
  const cls =
    level === "Beginner"
      ? "bg-emerald-50 text-emerald-600"
      : level === "Advanced"
        ? "bg-rose-50 text-rose-600"
        : "bg-violet-50 text-violet-600";
  return <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${cls}`}>{level}</span>;
}

/* Mini app-preview thumbnails, drawn in CSS so the demo needs no assets. */

function EcommerceThumb({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-2.5 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-900" />
        <span className="text-[7px] font-bold text-gray-800">Shop</span>
        <span className="ml-auto flex gap-1">
          <span className="h-1 w-4 rounded-full bg-gray-200" />
          <span className="h-1 w-4 rounded-full bg-gray-200" />
          <span className="h-1 w-4 rounded-full bg-gray-200" />
        </span>
      </div>
      <div className="flex flex-1 items-center gap-2 px-2.5 py-2">
        <span className="flex h-full min-h-14 flex-1 items-center justify-center rounded-lg bg-gray-100 text-2xl">
          👟
        </span>
        <span className="flex-1">
          <span className="block text-[6.5px] text-gray-400">Air Zoom Pegasus</span>
          <span className="block text-[8px] font-bold text-gray-900">₹8,999</span>
          <span className="mt-1 block w-10 rounded-sm py-0.5 text-center text-[6px] font-semibold text-white" style={{ backgroundColor: BLUE }}>
            Add to Cart
          </span>
        </span>
      </div>
    </div>
  );
}

function TaskThumb({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-2 ${className}`}>
      <div className="flex gap-1">
        <span className="h-3 w-6 rounded-sm bg-blue-500/80" />
        <span className="h-3 w-4 rounded-sm bg-blue-200" />
        <span className="h-3 w-5 rounded-sm bg-blue-300" />
      </div>
      <div className="mt-1.5 space-y-1">
        <span className="block h-1 w-full rounded-full bg-blue-200" />
        <span className="block h-1 w-4/5 rounded-full bg-blue-100" />
        <span className="block h-1 w-3/5 rounded-full bg-blue-100" />
      </div>
    </div>
  );
}

function GalleryThumb({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-1 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 p-1.5 ${className}`}>
      {["bg-violet-400", "bg-indigo-400", "bg-fuchsia-400", "bg-purple-400", "bg-violet-300", "bg-indigo-300"].map((c, i) => (
        <span key={i} className={`h-4 rounded-sm ${c}`} />
      ))}
    </div>
  );
}

function NotesThumb({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-pink-100 bg-gradient-to-br from-pink-50 to-white p-2 ${className}`}>
      <span className="flex h-4 w-4 items-center justify-center rounded-md bg-pink-400">
        <Brain className="h-2.5 w-2.5 text-white" />
      </span>
      <div className="mt-1.5 space-y-1">
        <span className="block h-1 w-full rounded-full bg-pink-200" />
        <span className="block h-1 w-4/5 rounded-full bg-pink-100" />
        <span className="block h-1 w-3/5 rounded-full bg-pink-100" />
      </div>
    </div>
  );
}

function DataThumb({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-end gap-1 overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-2 ${className}`}>
      {[8, 14, 6, 18, 11, 16].map((h, i) => (
        <span key={i} className="w-full rounded-t-sm bg-indigo-400/80" style={{ height: h }} />
      ))}
    </div>
  );
}

function AuthThumb({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl bg-gray-900 p-2 ${className}`}>
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
        <Lock className="h-3 w-3 text-white" />
      </span>
      <span className="block h-1 w-10 rounded-full bg-white/25" />
      <span className="block h-2 w-8 rounded-sm" style={{ backgroundColor: BLUE }} />
    </div>
  );
}

function WeatherThumb({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 p-2 text-white ${className}`}>
      <Sun className="h-3 w-3" />
      <div>
        <span className="block text-[13px] font-extrabold leading-none">24°C</span>
        <span className="mt-0.5 block h-1 w-8 rounded-full bg-white/40" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */

const FOCUS_TASKS = [
  { title: "Implement user authentication", minutes: 45 },
  { title: "Connect MongoDB database", minutes: 30 },
  { title: "Fix product schema and API", minutes: 40 },
  { title: "Complete AI assessment quiz", minutes: 15 },
];

const RECOMMENDED = [
  { name: "Task Management App", level: "Beginner", icon: LayoutList, tint: "bg-blue-50 text-blue-600" },
  { name: "Image Sharing Platform", level: "Intermediate", icon: GalleryIcon, tint: "bg-violet-50 text-violet-600" },
  { name: "AI Notes Generator", level: "Intermediate", icon: Brain, tint: "bg-pink-50 text-pink-500" },
] as const;


function HomeMetric({
  icon,
  label,
  value,
  extra,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  extra?: ReactNode;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      {icon}
      <div className="min-w-0">
        <p className="text-[13px] text-gray-500">{label}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[19px] font-extrabold tracking-[-0.01em]">
          {value}
          {extra}
        </p>
      </div>
    </Card>
  );
}

export function DemoDashboard() {
  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <DemoShell active="Home">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[15px] text-gray-500">Good evening,</p>
          <h1 className="mt-1 text-[34px] font-extrabold leading-tight tracking-[-0.03em]">
            Aryan 👋
          </h1>
          <p className="mt-1.5 text-[14.5px] text-gray-500">
            Keep learning. You're 48% towards your current goal.
          </p>
        </div>
        <QuoteBlock quote="Small consistent steps build real skills." />
      </div>

      <section className="mt-7 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <HomeMetric
          icon={
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Signal className="h-5 w-5" />
            </span>
          }
          label="Current Level"
          value="Intermediate"
          extra={<ArrowRight className="h-4 w-4 text-gray-400" />}
        />
        <HomeMetric
          icon={
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
              <Zap className="h-5 w-5" />
            </span>
          }
          label="Skills Mastered"
          value="12 / 24"
        />
        <HomeMetric
          icon={
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
              <Folder className="h-5 w-5" />
            </span>
          }
          label="Active Projects"
          value="2"
        />
        <Card className="flex items-center gap-4 p-5">
          <Donut pct={48} />
          <div>
            <p className="text-[13px] text-gray-500">Overall Progress</p>
            <p className="mt-0.5 text-[19px] font-extrabold tracking-[-0.01em]">48%</p>
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold">Current Project</h3>
            <Link to="/projects" className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-600 hover:underline">
              View Project <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-5 flex flex-col gap-6 sm:flex-row">
            <EcommerceThumb className="h-44 w-full shrink-0 sm:w-60" />
            <div className="min-w-0 flex-1">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-semibold text-emerald-600">
                In Progress
              </span>
              <h4 className="mt-3 text-[21px] font-extrabold tracking-[-0.02em]">
                Full Stack E-commerce App
              </h4>
              <p className="mt-1.5 text-[13.5px] leading-6 text-gray-500">
                Build a complete e-commerce platform with authentication, product
                management and payment integration.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                <TechChip name="React" />
                <TechChip name="Node.js" />
                <TechChip name="MongoDB" />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <ProgressBar pct={38} className="flex-1" />
              </div>
              <div className="mt-2 flex items-center justify-between text-[12.5px] text-gray-500">
                <span>3 of 8 milestones completed</span>
                <span className="font-bold text-gray-900">38%</span>
              </div>
              <Link
                to="/projects"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-gray-800"
              >
                Continue Building <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold">Today's Focus</h3>
            <span className="text-[12.5px] text-gray-400">{today}</span>
          </div>
          <ol className="mt-5 space-y-4">
            {FOCUS_TASKS.map((task, i) => (
              <li key={task.title} className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold ${
                    i === 0 ? "text-white" : "bg-gray-100 text-gray-500"
                  }`}
                  style={i === 0 ? { backgroundColor: BLUE } : undefined}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                  {task.title}
                </span>
                <span className="shrink-0 text-[12.5px] text-gray-400">~ {task.minutes} min</span>
              </li>
            ))}
          </ol>
          <Link
            to="/learning-path"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BLUE }}
          >
            <Play className="h-4 w-4 fill-current" />
            Start Today's Plan
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-bold">Recommended for You</h3>
          <Link to="/projects" className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-600 hover:underline">
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECOMMENDED.map(({ name, level, icon: Icon, tint }) => (
            <Link key={name} to="/projects">
              <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-md">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{name}</span>
                  <span className="mt-1 inline-block">
                    <LevelPill level={level} />
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </DemoShell>
  );
}

/* ------------------------------------------------------------------ */
/* Learning Path                                                       */
/* ------------------------------------------------------------------ */

const PATH_STEPS = [
  { name: "Foundations", skills: "3 / 6 skills" },
  { name: "Frontend", skills: "0 / 8 skills" },
  { name: "Backend", skills: "0 / 8 skills" },
  { name: "Databases", skills: "0 / 4 skills" },
  { name: "Deployment", skills: "0 / 4 skills" },
];

const MODULES = [
  { n: 1, name: "Foundations", skills: "3 / 6 skills" },
  { n: 2, name: "Frontend Development", skills: "0 / 8 skills" },
  { n: 3, name: "Backend Development", skills: "0 / 8 skills" },
  { n: 4, name: "Databases", skills: "0 / 4 skills" },
  { n: 5, name: "Deployment & DevOps", skills: "0 / 4 skills" },
  { n: 6, name: "Real World Projects", skills: "0 / 4 skills" },
];

type LessonStatus = "completed" | "current" | "locked";

const LESSONS: { n: number; title: string; desc: string; status: LessonStatus }[] = [
  { n: 1, title: "Programming Basics", desc: "Variables, data types, operators, control flow", status: "completed" },
  { n: 2, title: "Git & GitHub", desc: "Version control, repositories, collaboration", status: "completed" },
  { n: 3, title: "Problem Solving with Python", desc: "Logic building, functions, basic data structures", status: "completed" },
  { n: 4, title: "HTML & CSS Fundamentals", desc: "Build and style web pages", status: "current" },
  { n: 5, title: "JavaScript Basics", desc: "DOM, events, functions, ES6+", status: "locked" },
  { n: 6, title: "Command Line & Linux Basics", desc: "File system, essential commands", status: "locked" },
];

const LEARN_POINTS = [
  "HTML structure and elements",
  "CSS selectors and properties",
  "Flexbox and Grid layout",
  "Responsive web design",
  "Build a personal portfolio page",
];

function PathStat({
  icon,
  label,
  value,
  sub,
  bar,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  bar?: number;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3.5">
        {icon}
        <div>
          <p className="text-[13px] text-gray-500">{label}</p>
          <p className="mt-0.5 text-[19px] font-extrabold tracking-[-0.01em]">
            {value}
            {sub && <span className="ml-2 text-[12px] font-medium text-gray-400">{sub}</span>}
          </p>
        </div>
      </div>
      {bar !== undefined && <ProgressBar pct={bar} className="mt-3.5" />}
    </Card>
  );
}

function LessonRow({ lesson }: { lesson: (typeof LESSONS)[number] }) {
  const icon =
    lesson.status === "completed" ? (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-4.5 w-4.5" strokeWidth={3} />
      </span>
    ) : lesson.status === "current" ? (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: BLUE }}>
        <Play className="h-4 w-4 fill-current" />
      </span>
    ) : (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <Lock className="h-4 w-4" />
      </span>
    );
  return (
    <div className="flex items-center gap-4 border-b border-gray-50 py-3.5 last:border-b-0">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-bold">
          {lesson.n}. {lesson.title}
        </p>
        <p className="mt-0.5 text-[12.5px] text-gray-500">{lesson.desc}</p>
      </div>
      {lesson.status === "completed" && (
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-600">
          Completed
        </span>
      )}
      {lesson.status === "current" && (
        <span className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: BLUE }}>
          Continue
        </span>
      )}
      {lesson.status === "locked" && (
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[12px] font-semibold text-gray-400">
          Locked
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
    </div>
  );
}

export function DemoLearningPath() {
  return (
    <DemoShell active="Learning Path">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-[-0.03em]">Learning Path</h1>
          <p className="mt-1.5 text-[14.5px] text-gray-500">
            A personalized roadmap to turn your goals into real skills.
          </p>
        </div>
        <QuoteBlock quote="Learn. Build. Practice. Prove. Improve." />
      </div>

      <Card className="mt-7 p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4 lg:w-64 lg:shrink-0">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Target className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[12px] text-gray-500">Your Goal</p>
              <p className="text-[16px] font-extrabold">Full Stack Developer</p>
              <button type="button" className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-blue-600 hover:underline">
                Edit Goal <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 items-start">
            {PATH_STEPS.map((step, i) => (
              <div key={step.name} className="flex min-w-0 flex-1 items-start last:flex-none">
                <div className="flex w-16 flex-col items-center sm:w-20">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold ${
                      i === 0 ? "text-white" : "bg-gray-100 text-gray-500"
                    }`}
                    style={i === 0 ? { backgroundColor: BLUE } : undefined}
                  >
                    {i + 1}
                  </span>
                  <span className="mt-2 text-center text-[12.5px] font-bold leading-tight">
                    {step.name}
                  </span>
                  <span className="mt-0.5 text-center text-[11px] text-gray-400">
                    {step.skills}
                  </span>
                </div>
                {i < PATH_STEPS.length - 1 && (
                  <span className="mt-[18px] h-0.5 min-w-2 flex-1 rounded-full bg-gray-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <section className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <PathStat
          icon={
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Signal className="h-5 w-5" />
            </span>
          }
          label="Overall Progress"
          value="18%"
          bar={18}
        />
        <PathStat
          icon={
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
              <Check className="h-5 w-5" strokeWidth={3} />
            </span>
          }
          label="Skills Mastered"
          value="3 / 24"
        />
        <PathStat
          icon={
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
              <Clock className="h-5 w-5" />
            </span>
          }
          label="Estimated Time"
          value="16 weeks"
          sub="~ 4 hrs/week"
        />
        <PathStat
          icon={
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-500">
              <Target className="h-5 w-5" />
            </span>
          }
          label="Current Streak"
          value="5 days 🔥"
        />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-3">
          {MODULES.map((m) => (
            <button
              key={m.n}
              type="button"
              className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-shadow ${
                m.n === 1
                  ? "border-transparent text-white shadow-lg"
                  : "border-gray-100 bg-white hover:shadow-md"
              }`}
              style={m.n === 1 ? { backgroundColor: BLUE } : undefined}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  m.n === 1 ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {m.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[14px] font-bold ${m.n === 1 ? "text-white" : ""}`}>
                  {m.name}
                </span>
                <span className={`block text-[11.5px] ${m.n === 1 ? "text-white/75" : "text-gray-400"}`}>
                  {m.skills}
                </span>
              </span>
              <ChevronRight className={`h-4 w-4 shrink-0 ${m.n === 1 ? "text-white/80" : "text-gray-300"}`} />
            </button>
          ))}
        </div>

        <Card className="p-6 lg:col-span-5">
          <div className="flex items-center gap-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-[13px] font-bold text-gray-600">
              1
            </span>
            <div>
              <h3 className="text-[17px] font-bold">Foundations</h3>
              <p className="text-[12.5px] text-gray-500">
                Build a strong base before moving to advanced topics.
              </p>
            </div>
          </div>
          <div className="mt-4">
            {LESSONS.map((lesson) => (
              <LessonRow key={lesson.n} lesson={lesson} />
            ))}
          </div>
        </Card>

        <div className="space-y-5 lg:col-span-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-[14px] font-bold text-gray-700">
                <Play className="h-4 w-4 text-blue-600" /> Current Module
              </h4>
              <button type="button" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-blue-600 hover:underline">
                View All <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2.5">
              <h3 className="text-[17px] font-extrabold">HTML & CSS Fundamentals</h3>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
                In Progress
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-gray-500">
              Learn the structure of web pages and how to style them using CSS.
            </p>
            <ProgressBar pct={50} className="mt-4" />
            <div className="mt-2 flex items-center justify-between text-[12.5px] text-gray-500">
              <span>4 of 8 lessons completed</span>
              <span className="font-bold text-gray-900">50%</span>
            </div>
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: BLUE }}
            >
              Continue Learning <ArrowRight className="h-4 w-4" />
            </button>
          </Card>

          <Card className="p-6">
            <h4 className="flex items-center gap-2 text-[14px] font-bold text-gray-700">
              <BookOpen className="h-4 w-4 text-blue-600" /> What You'll Learn
            </h4>
            <ul className="mt-4 space-y-3">
              {LEARN_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-3 text-[13.5px] font-medium text-gray-700">
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={3} />
                  {point}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>
    </DemoShell>
  );
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

const PROJECT_TABS = [
  { label: "All Projects", icon: LayoutGrid },
  { label: "Web Development", icon: Globe },
  { label: "Data & AI", icon: BarChart3 },
  { label: "Tools & Automation", icon: Settings },
  { label: "Other", icon: LayoutList },
];

const ALL_PROJECTS = [
  {
    name: "Task Management App",
    desc: "Build a productivity app with authentication, task CRUD and real-time updates.",
    tech: ["React", "Firebase"],
    weeks: 4,
    level: "Beginner",
    Thumb: TaskThumb,
  },
  {
    name: "Image Sharing Platform",
    desc: "A social platform to upload, share and explore images with user authentication.",
    tech: ["Next.js", "MongoDB"],
    weeks: 6,
    level: "Intermediate",
    Thumb: GalleryThumb,
  },
  {
    name: "AI Notes Generator",
    desc: "Generate, organize and summarize notes using AI.",
    tech: ["React", "OpenAI"],
    weeks: 3,
    level: "Intermediate",
    Thumb: NotesThumb,
  },
  {
    name: "Data Analysis Dashboard",
    desc: "Build an interactive dashboard for data visualization and analysis.",
    tech: ["Python", "Plotly"],
    weeks: 5,
    level: "Intermediate",
    Thumb: DataThumb,
  },
  {
    name: "User Authentication System",
    desc: "Implement secure authentication with JWT, role-based access and 2FA.",
    tech: ["Node.js", "MongoDB"],
    weeks: 3,
    level: "Beginner",
    Thumb: AuthThumb,
  },
  {
    name: "Weather Forecast App",
    desc: "Fetch and display real-time weather data with beautiful UI.",
    tech: ["React", "OpenWeather"],
    weeks: 2,
    level: "Beginner",
    Thumb: WeatherThumb,
  },
];

export function DemoProjects() {
  const [tab, setTab] = useState("All Projects");
  return (
    <DemoShell active="Projects">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-[-0.03em]">Projects</h1>
          <p className="mt-1.5 text-[14.5px] text-gray-500">
            Build real-world projects. Turn your knowledge into skills.
          </p>
        </div>
        <QuoteBlock quote="Build, break, learn, repeat." />
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-2">
        {PROJECT_TABS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(label)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
              tab === label
                ? "bg-blue-50 text-blue-600"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search projects..."
              aria-label="Search projects"
              className="h-10 w-48 rounded-full border border-gray-200 bg-white pl-10 pr-4 text-[13px] outline-none placeholder:text-gray-400 focus:border-blue-300"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ListChecks className="h-4 w-4" />
            Filters
          </button>
        </div>
      </div>

      <Card className="mt-6 p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <EcommerceThumb className="h-44 w-full shrink-0 lg:w-56" />
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-semibold text-emerald-600">
              Featured Project
            </span>
            <h3 className="mt-3 text-[21px] font-extrabold tracking-[-0.02em]">
              Full Stack E-commerce App
            </h3>
            <p className="mt-1.5 text-[13.5px] leading-6 text-gray-500">
              Build a complete e-commerce platform with authentication, product
              management and payment integration.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <TechChip name="React" />
              <TechChip name="Node.js" />
              <TechChip name="MongoDB" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> 8 weeks
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" /> 8 milestones
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Signal className="h-3.5 w-3.5" /> Intermediate
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col justify-center lg:w-64">
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: BLUE }}
            >
              Continue Building <ArrowRight className="h-4 w-4" />
            </button>
            <div className="mt-3 flex items-center justify-between text-[12.5px] text-gray-500">
              <span>3 of 8 milestones completed</span>
              <span className="font-bold text-gray-900">38%</span>
            </div>
            <ProgressBar pct={38} className="mt-2" />
          </div>
        </div>
      </Card>

      <div className="mt-8 flex items-center justify-between">
        <h3 className="text-[19px] font-extrabold tracking-[-0.01em]">All Projects</h3>
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] text-gray-500">Sort by</span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-700"
          >
            Popular <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
          <span className="flex items-center gap-1">
            <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <span className="rounded-lg p-1.5 text-gray-400">
              <LayoutList className="h-4 w-4" />
            </span>
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {ALL_PROJECTS.map(({ name, desc, tech, weeks, level, Thumb }) => (
          <Card key={name} className="p-5 transition-shadow hover:shadow-md">
            <div className="flex items-start gap-4">
              <Thumb className="h-16 w-16 shrink-0" />
              <div className="min-w-0 flex-1 pt-0.5">
                <h4 className="truncate text-[15.5px] font-bold">{name}</h4>
              </div>
              <Bookmark className="h-4 w-4 shrink-0 text-gray-300" />
            </div>
            <p className="mt-3 text-[13px] leading-5 text-gray-500">{desc}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {tech.map((t) => (
                <TechChip key={t} name={t} />
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 border-t border-gray-50 pt-3 text-[12.5px] text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {weeks} weeks
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Signal className="h-3.5 w-3.5" /> {level}
              </span>
              <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Card>
        ))}
      </div>
    </DemoShell>
  );
}
