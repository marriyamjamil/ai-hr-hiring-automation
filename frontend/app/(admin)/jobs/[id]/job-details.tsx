"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, CheckCircle2, Clock, Loader2, Lock, MapPin, Trash2, Unlock, Upload } from "lucide-react";
import { toast } from "sonner";

import { MarkdownView } from "@/components/shared/markdown-view";
import { StatusBadge } from "@/components/shared/status-badge";
import { ResumeUpload } from "@/components/jobs/resume-upload";
import { CandidateList } from "@/components/jobs/candidate-list";
import { approveJob, deleteJob, getJob, updateJob, type Job } from "@/lib/api";

const rubricLabels: Record<string, string> = {
  required_skills: "Required skills",
  relevant_experience: "Relevant experience",
  projects: "Projects",
  education_certifications: "Education & certifications",
  other_job_related: "Other job-related",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function JobDetails() {
  const { id } = useParams<{ id: string }>(); // "/jobs/5" → id = "5"
  const jobId = Number(id); // "5" → 5
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null); // null = still loading
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(""); // which button is working: "approve", "close", "delete" or ""
  const [refreshKey, setRefreshKey] = useState(0); // +1 after each upload → the candidate list reloads

  // Load this job when the page opens (or when the id changes)
  useEffect(() => {
    getJob(jobId)
      .then(setJob)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the job."));
  }, [jobId]);

  // Run a button's action, show a message, and refresh the job on screen
  async function run(name: string, action: () => Promise<Job>, success: string) {
    setBusy(name);
    try {
      setJob(await action()); // the backend sends back the updated job
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this job? This cannot be undone.")) return; // "Are you sure?"
    setBusy("delete");
    try {
      await deleteJob(jobId);
      toast.success("Job deleted.");
      router.push("/jobs");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the job.");
      setBusy("");
    }
  }

  // ---------- Error or loading ----------
  if (error) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <BackLink />
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      </div>
    );
  }
  if (!job) {
    return <div className="mx-auto h-96 max-w-5xl animate-pulse rounded-2xl bg-muted" />;
  }

  // ---------- The page ----------
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackLink />

      {/* Header: icon, title, status, facts + buttons */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
            <Briefcase className="size-6" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">{job.title}</h1>
              <StatusBadge status={job.status} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {job.department && <span>{job.department}</span>}
              {job.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {job.location}</span>}
              {job.experience && <span>{job.experience} experience</span>}
              <span className="flex items-center gap-1"><Clock className="size-3.5" /> Created {formatDate(job.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {job.status === "draft" && (
            <ActionButton primary busy={busy === "approve"} disabled={!!busy} onClick={() => run("approve", () => approveJob(jobId), "Job approved!")}>
              <CheckCircle2 className="size-4" /> Approve
            </ActionButton>
          )}
          {job.status === "approved" && (
            <ActionButton busy={busy === "close"} disabled={!!busy} onClick={() => run("close", () => updateJob(jobId, { status: "closed" }), "Job closed.")}>
              <Lock className="size-4" /> Close job
            </ActionButton>
          )}
          {job.status === "closed" && (
            <ActionButton busy={busy === "close"} disabled={!!busy} onClick={() => run("close", () => updateJob(jobId, { status: "approved" }), "Job reopened.")}>
              <Unlock className="size-4" /> Reopen
            </ActionButton>
          )}
          <ActionButton danger busy={busy === "delete"} disabled={!!busy} onClick={handleDelete}>
            <Trash2 className="size-4" /> Delete
          </ActionButton>
        </div>
      </div>

      {/* CV upload: only for approved (open) jobs */}
      {job.status === "approved" ? (
        <ResumeUpload jobId={jobId} onUploaded={() => setRefreshKey((key) => key + 1)} />
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-dashed bg-card p-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
            <Upload className="size-5" />
          </span>
          <div>
            <p className="font-semibold">Candidates</p>
            <p className="text-sm text-muted-foreground">
              {job.status === "draft"
                ? "Approve this job first. Then you can upload CVs."
                : "This job is closed. Reopen it to upload more CVs."}
            </p>
          </div>
        </div>
      )}

      {/* Ranked candidates (drafts can't have any, so hide it there) */}
      {job.status !== "draft" && <CandidateList jobId={jobId} refreshKey={refreshKey} />}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left (wide): the job description */}
        <section className="rounded-2xl border bg-card p-6 shadow-xs lg:col-span-2">
          {job.jd_text ? <MarkdownView text={job.jd_text} /> : <p className="text-sm text-muted-foreground">No job description yet.</p>}
        </section>

        {/* Right (narrow): skills, rubric, questions */}
        <div className="space-y-6">
          <SideCard title="Skills">
            <div className="flex flex-wrap gap-1.5">
              {job.required_skills.map((skill) => (
                <span key={skill} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{skill}</span>
              ))}
              {job.preferred_skills.map((skill) => (
                <span key={skill} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{skill} (preferred)</span>
              ))}
            </div>
          </SideCard>

          <SideCard title="Scoring rubric">
            <div className="space-y-3">
              {Object.entries(job.rubric).map(([name, weight]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm">
                    <span>{rubricLabels[name] ?? name}</span>
                    <span className="font-semibold">{weight}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600" style={{ width: `${weight}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </SideCard>

          <SideCard title="Screening questions">
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {job.screening_questions.map((question, i) => <li key={i}>{question}</li>)}
            </ol>
          </SideCard>
        </div>
      </div>
    </div>
  );
}

// ---------- Small building blocks ----------

function BackLink() {
  return (
    <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Back to jobs
    </Link>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
      <h2 className="font-display font-bold">{title}</h2>
      {children}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  busy,
  disabled,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const look = primary
    ? "bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
    : danger
      ? "border border-destructive/30 text-destructive hover:bg-destructive/10"
      : "border hover:bg-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60 ${look}`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
}
