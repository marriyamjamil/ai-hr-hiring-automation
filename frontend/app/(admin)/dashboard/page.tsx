"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CircleCheck,
  CloudUpload,
  FileSearch,
  FileText,
  PhoneCall,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { ScoreRing } from "@/components/shared/score-ring";
import { StatusBadge } from "@/components/shared/status-badge";
import { getJobCandidates, getJobs, type CandidateSummary, type Job } from "@/lib/api";
import { photos } from "@/lib/images";

type RankedCandidate = CandidateSummary & { jobTitle: string; jobId: number };

type DashboardData = {
  jobs: Job[];
  candidates: RankedCandidate[];
};

// The 4 AI agents of the project and whether they are built yet
const agents = [
  { name: "JD Generator", text: "Writes job descriptions", icon: Sparkles, live: true, tint: "from-indigo-500 to-violet-500" },
  { name: "Resume Scorer", text: "Scores CVs against the rubric", icon: FileSearch, live: true, tint: "from-sky-500 to-indigo-500" },
  { name: "Screening Calls", text: "AI voice screening", icon: PhoneCall, live: false, tint: "from-fuchsia-500 to-pink-500" },
  { name: "Interview Scheduler", text: "Books interviews", icon: CalendarCheck, live: false, tint: "from-emerald-500 to-teal-500" },
];

// How each candidate status is shown in the pipeline chart
const pipeline = [
  { status: "resume_received", label: "Received", color: "bg-sky-500" },
  { status: "needs_manual_review", label: "Needs review", color: "bg-orange-500" },
  { status: "scored", label: "Scored", color: "bg-indigo-500" },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  // Load the jobs, then the candidates of every job
  useEffect(() => {
    async function load() {
      try {
        const jobs = await getJobs();
        const lists = await Promise.all(jobs.map((job) => getJobCandidates(job.id)));
        const candidates = lists.flatMap((list, i) =>
          list.map((c) => ({ ...c, jobTitle: jobs[i].title, jobId: jobs[i].id })),
        );
        setData({ jobs, candidates });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the dashboard.");
      }
    }
    load();
  }, []);

  const jobs = data?.jobs ?? [];
  const candidates = data?.candidates ?? [];
  const scored = candidates.filter((c) => c.overall_score !== null);
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, c) => sum + (c.overall_score ?? 0), 0) / scored.length)
    : 0;
  const topCandidates = [...scored].sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0)).slice(0, 5);

  const stats = [
    { label: "Total jobs", value: jobs.length, icon: Briefcase, tint: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10" },
    { label: "Open roles", value: jobs.filter((j) => j.status === "approved").length, icon: CircleCheck, tint: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" },
    { label: "Drafts", value: jobs.filter((j) => j.status === "draft").length, icon: FileText, tint: "bg-amber-50 text-amber-600 dark:bg-amber-500/10" },
    { label: "Candidates", value: candidates.length, icon: Users, tint: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ================= WELCOME BANNER ================= */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute -right-10 -bottom-24 size-72 rounded-full bg-white/10 blur-2xl" />
        <div className="relative grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-medium text-indigo-100">{greeting()} 👋</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-2 max-w-lg text-indigo-100">
              {data
                ? `You have ${jobs.filter((j) => j.status === "draft").length} draft job(s) and ${candidates.length} candidate(s) in your pipeline.`
                : "Loading your hiring overview..."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/jobs/new"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-indigo-700 shadow-lg transition-transform hover:scale-105"
              >
                <Sparkles className="size-4" /> Create job with AI
              </Link>
              <Link
                href="/jobs"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/20"
              >
                <CloudUpload className="size-4" /> Upload CVs
              </Link>
            </div>
          </div>
          <div className="relative hidden size-40 overflow-hidden rounded-2xl border-4 border-white/20 shadow-2xl md:block lg:size-44">
            <Image src={photos.highFive} alt="" fill sizes="176px" className="object-cover" />
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}

      {/* ================= STAT CARDS ================= */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="group rounded-2xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <span className={`flex size-11 items-center justify-center rounded-xl ${stat.tint}`}>
                <stat.icon className="size-5" />
              </span>
              <TrendingUp className="size-4 text-muted-foreground/50" />
            </div>
            {data ? (
              <p className="mt-4 font-display text-3xl font-extrabold tracking-tight">{stat.value}</p>
            ) : (
              <div className="mt-4 h-9 w-16 animate-pulse rounded-md bg-muted" />
            )}
            <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ================= TOP CANDIDATES ================= */}
        <section className="rounded-2xl border bg-card shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="font-display font-bold">Top candidates</h2>
              <p className="text-xs text-muted-foreground">Highest AI scores across all jobs</p>
            </div>
            <Link href="/candidates" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>

          {!data && !error && <ListSkeleton />}

          {data && topCandidates.length === 0 && (
            <EmptyState
              icon={Users}
              title="No scored candidates yet"
              text="Approve a job, upload some CVs, and the best matches will appear here."
            />
          )}

          {topCandidates.length > 0 && (
            <ul className="divide-y">
              {topCandidates.map((c, i) => (
                <li key={c.id}>
                  <Link href={`/candidates/${c.id}`} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50">
                    <span className="w-5 text-sm font-bold text-muted-foreground">{i + 1}</span>
                    <ScoreRing score={c.overall_score ?? 0} size={48} stroke={5} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{c.summary ?? c.jobTitle}</p>
                    </div>
                    <span className="hidden rounded-full bg-muted px-3 py-1 text-xs font-medium sm:inline">{c.jobTitle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ================= PIPELINE ================= */}
        <section className="rounded-2xl border bg-card p-6 shadow-xs">
          <h2 className="font-display font-bold">Candidate pipeline</h2>
          <p className="text-xs text-muted-foreground">Where every CV is right now</p>

          <div className="mt-6 flex items-center justify-center">
            <div className="relative">
              <ScoreRing score={averageScore} size={140} stroke={12} />
              <p className="mt-2 text-center text-xs text-muted-foreground">Average score</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {pipeline.map((stage) => {
              const count = candidates.filter((c) => c.status === stage.status).length;
              const percent = candidates.length ? (count / candidates.length) * 100 : 0;
              return (
                <div key={stage.status}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${stage.color}`} />
                      {stage.label}
                    </span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${stage.color} transition-all duration-1000`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ================= RECENT JOBS ================= */}
        <section className="rounded-2xl border bg-card shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="font-display font-bold">Recent jobs</h2>
              <p className="text-xs text-muted-foreground">Your latest openings</p>
            </div>
            <Link href="/jobs" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>

          {!data && !error && <ListSkeleton />}

          {data && jobs.length === 0 && (
            <EmptyState icon={Briefcase} title="No jobs yet" text="Create your first job and let AI write the description." />
          )}

          {jobs.length > 0 && (
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              {jobs.slice(0, 4).map((job) => {
                const count = candidates.filter((c) => c.jobId === job.id).length;
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="group rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 text-white">
                        <Briefcase className="size-5" />
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="mt-4 truncate font-display font-bold group-hover:text-primary">{job.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[job.department, job.location].filter(Boolean).join(" · ") || "No details yet"}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="size-3.5" /> {count} candidate{count === 1 ? "" : "s"}
                      </span>
                      <span>{formatDate(job.created_at)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ================= AI AGENTS ================= */}
        <section className="rounded-2xl border bg-card p-6 shadow-xs">
          <h2 className="font-display font-bold">AI agents</h2>
          <p className="text-xs text-muted-foreground">Your automated hiring team</p>
          <ul className="mt-5 space-y-3">
            {agents.map((agent) => (
              <li key={agent.name} className="flex items-center gap-3 rounded-xl border p-3">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${agent.tint} text-white`}>
                  <agent.icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{agent.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{agent.text}</p>
                </div>
                {agent.live ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Soon</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-14 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-display font-bold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
