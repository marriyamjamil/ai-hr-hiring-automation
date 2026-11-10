"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, HelpCircle, Info, Mail, Phone, Sparkles } from "lucide-react";

import { DecisionPanel } from "@/components/candidates/decision-panel";
import { ScreeningPanel } from "@/components/candidates/screening-panel";
import { ScoreRing } from "@/components/shared/score-ring";
import { StatusBadge } from "@/components/shared/status-badge";
import { getCandidate, getJob, type CandidateDetail, type Job } from "@/lib/api";

const criterionLabels: Record<string, string> = {
  required_skills: "Required skills",
  relevant_experience: "Relevant experience",
  projects: "Projects",
  education_certifications: "Education & certifications",
  other_job_related: "Other job-related",
};

function matchLabel(score: number) {
  if (score >= 75) return { text: "Strong match", className: "text-emerald-600" };
  if (score >= 50) return { text: "Possible match", className: "text-indigo-600" };
  return { text: "Weak match", className: "text-amber-600" };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function CandidateDetails() {
  const { id } = useParams<{ id: string }>(); // "/candidates/12" → "12"
  const candidateId = Number(id);

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [job, setJob] = useState<Job | null>(null); // to show "Applied for Python Developer"
  const [error, setError] = useState("");

  // Load the candidate, then the job they applied for
  useEffect(() => {
    getCandidate(candidateId)
      .then((data) => {
        setCandidate(data);
        return getJob(data.job_id);
      })
      .then(setJob)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the candidate."));
  }, [candidateId]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to jobs
        </Link>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      </div>
    );
  }
  if (!candidate) {
    return <div className="mx-auto h-96 max-w-5xl animate-pulse rounded-2xl bg-muted" />;
  }

  const evaluation = candidate.evaluation;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back to the job this candidate applied for */}
      <Link
        href={`/jobs/${candidate.job_id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to {job ? job.title : "the job"}
      </Link>

      {/* ---------- Header: name, contact, score ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border bg-card p-6 shadow-xs">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{candidate.name}</h1>
            <StatusBadge status={candidate.status} />
          </div>
          {job && <p className="mt-1 text-sm text-muted-foreground">Applied for {job.title}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {candidate.email && (
              <a href={`mailto:${candidate.email}`} className="flex items-center gap-1.5 hover:text-foreground">
                <Mail className="size-4" /> {candidate.email}
              </a>
            )}
            {candidate.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="size-4" /> {candidate.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" /> CV received {formatDate(candidate.created_at)}
            </span>
          </div>
        </div>

        {evaluation && (
          <div className="flex items-center gap-4">
            <ScoreRing score={evaluation.overall_score} size={88} stroke={8} />
            <div>
              <p className={`font-semibold ${matchLabel(evaluation.overall_score).className}`}>
                {matchLabel(evaluation.overall_score).text}
              </p>
              <p className="text-xs text-muted-foreground">AI score out of 100</p>
            </div>
          </div>
        )}
      </div>

      {/* ---------- HR's decision (shortlist / reject / undo) + history ---------- */}
      <DecisionPanel candidate={candidate} onChange={setCandidate} />

      {/* ---------- Agent 2: screening call + report ---------- */}
      <ScreeningPanel
        candidate={candidate}
        onChange={() => getCandidate(candidateId).then(setCandidate).catch(() => {})}
      />

      {/* ---------- Not scored: explain why ---------- */}
      {!evaluation && (
        <div className="flex gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
          <AlertTriangle className="size-5 shrink-0" />
          <p>
            This CV was not scored. The text could not be read (it may be a scanned image) or the AI failed. Please open
            the CV and review it yourself.
          </p>
        </div>
      )}

      {evaluation && (
        <>
          {/* ---------- AI summary ---------- */}
          {evaluation.summary && (
            <Card title="AI summary" icon={<Sparkles className="size-4 text-indigo-600" />}>
              <p className="text-sm leading-relaxed">{evaluation.summary}</p>
            </Card>
          )}

          {/* ---------- Score breakdown (one bar per rubric criterion) ---------- */}
          <Card title="Score breakdown" icon={<Info className="size-4 text-indigo-600" />}>
            <div className="space-y-5">
              {Object.entries(evaluation.criterion_scores).map(([name, item]) => {
                const percent = item.max ? (item.score / item.max) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium">{criterionLabels[name] ?? name}</span>
                      <span className="font-semibold">
                        {item.score} / {item.max}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* ---------- Evidence found in the CV ---------- */}
            <Card title="Evidence from the CV" icon={<CheckCircle2 className="size-4 text-emerald-600" />}>
              <BulletList items={evaluation.evidence} empty="No evidence listed." />
            </Card>

            {/* ---------- Missing or unclear ---------- */}
            <Card title="Missing or unclear" icon={<HelpCircle className="size-4 text-amber-600" />}>
              <BulletList items={evaluation.missing_or_unclear} empty="Nothing missing." />
            </Card>
          </div>

          {/* ---------- Warnings (only if any) ---------- */}
          {evaluation.warnings.length > 0 && (
            <Card title="Warnings" icon={<AlertTriangle className="size-4 text-orange-500" />}>
              <BulletList items={evaluation.warnings} empty="" />
            </Card>
          )}

          {/* ---------- Human-in-the-loop note ---------- */}
          <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-4 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            This score is an AI recommendation to help HR prioritise CVs. It is not a hiring decision. Scored by{" "}
            {evaluation.model_version ?? "the AI model"} on {formatDate(evaluation.created_at)}.
          </p>
        </>
      )}
    </div>
  );
}

// ---------- Small building blocks ----------

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-xs">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
