"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bot, Copy, Info, Link2, Loader2, PhoneCall, RefreshCw, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { ScoreRing } from "@/components/shared/score-ring";
import {
  createInvite,
  getInvite,
  getScreeningCalls,
  retryScreeningReport,
  type CandidateDetail,
  type ScreeningCall,
  type ScreeningInvite,
  type ScreeningMessage,
  type ScreeningReport,
} from "@/lib/api";

const recommendationStyles: Record<string, { text: string; className: string }> = {
  proceed: {
    text: "AI suggests: proceed",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  maybe: { text: "AI suggests: maybe", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  not_recommended: {
    text: "AI suggests: not recommended",
    className: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  },
};

const callStatusLabels: Record<string, string> = {
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const inviteLabels: Record<string, { text: string; className: string }> = {
  pending: { text: "Active", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  used: { text: "Used", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400" },
  cancelled: { text: "Cancelled", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400" },
  expired: { text: "Expired", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Agent 2's voice screening call on the candidate page (HR only reads it here)
export function ScreeningPanel({ candidate }: { candidate: CandidateDetail }) {
  const [calls, setCalls] = useState<ScreeningCall[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<ScreeningInvite | null>(null); // the newest interview link

  // Load the calls and the interview link (again whenever the candidate's status changes)
  useEffect(() => {
    Promise.all([getScreeningCalls(candidate.id), getInvite(candidate.id)])
      .then(([callList, latest]) => {
        setCalls(callList);
        setInvite(latest);
      })
      .catch(() => toast.error("Could not load the screening calls."))
      .finally(() => setLoaded(true));
  }, [candidate.id, candidate.status]);

  const call = calls.at(-1); // the latest call (the list is oldest first)

  async function retry() {
    if (!call) return;
    setBusy(true);
    try {
      const updated = await retryScreeningReport(call.id);
      setCalls((previous) => previous.map((c) => (c.id === updated.id ? updated : c)));
      toast.success("Report ready.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not write the report.");
    } finally {
      setBusy(false);
    }
  }

  // Nothing to show: no calls yet and the candidate is not shortlisted
  if (!loaded) return null;
  if (!call && candidate.status !== "shortlisted") return null;

  return (
    <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-xs">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <PhoneCall className="size-4 text-indigo-600" /> Screening call (Agent 2)
        </h2>
        <p className="text-sm text-muted-foreground">
          The candidate talks to Agent 2 by voice using their private link. The transcript and report appear here.
        </p>
      </div>

      {(candidate.status === "shortlisted" || candidate.status === "screening_in_progress") && (
        <InviteBox candidate={candidate} invite={invite} onCreated={setInvite} />
      )}

      {!call && (
        <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          Waiting for the candidate to do their voice interview.
        </p>
      )}

      {call && (
        <>
          <p className="text-xs text-muted-foreground">
            Call #{call.id} · {call.mode === "voice" ? "Voice" : "Text"} · {callStatusLabels[call.status] ?? call.status}{" "}
            · started {formatDateTime(call.started_at)}
          </p>

          {call.status === "in_progress" ? (
            <p className="flex items-center gap-2 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> The candidate is doing the interview now…
            </p>
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto rounded-xl border bg-muted/30 p-4">
              {call.transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground">No conversation was recorded.</p>
              ) : (
                call.transcript.map((message, i) => <Bubble key={i} message={message} />)
              )}
            </div>
          )}

          {/* ---------- The report (after the call) ---------- */}
          {call.status === "completed" &&
            (call.report ? (
              <ReportView call={call} report={call.report} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
                <p>The call is finished, but the AI could not write the report yet.</p>
                <button
                  type="button"
                  onClick={retry}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full border border-orange-300 px-4 py-1.5 font-semibold disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Try again
                </button>
              </div>
            ))}
        </>
      )}
    </section>
  );
}

// ---------- Small building blocks ----------

// One chat bubble: the agent on the left, the candidate on the right
function Bubble({ message }: { message: ScreeningMessage }) {
  const isAgent = message.role === "agent";
  return (
    <div className={`flex gap-2 ${isAgent ? "" : "flex-row-reverse"}`}>
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
          isAgent ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" : "bg-muted"
        }`}
      >
        {isAgent ? <Bot className="size-4" /> : <User className="size-4" />}
      </span>
      <p
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
          isAgent ? "border bg-card" : "bg-indigo-600 text-white"
        }`}
      >
        {message.text}
      </p>
    </div>
  );
}

// The report GPT wrote after the call: the basic HR facts (notice period, salary, availability...)
function ReportView({ call, report }: { call: ScreeningCall; report: ScreeningReport }) {
  if (!report.details) return <ScoredReportView call={call} report={report} />; // an old test call

  const total = report.total_questions ?? report.details.length;
  const answered = report.answered_count ?? total;
  return (
    <div className="space-y-5 border-t pt-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <Sparkles className="size-4 text-indigo-600" /> Call report
      </h3>

      {report.summary && <p className="text-sm leading-relaxed">{report.summary}</p>}

      {/* Warn HR if some details are missing */}
      {answered < total && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {answered} of {total} details collected. Missing: {(report.missing ?? []).join(", ")}.
        </p>
      )}

      {/* The candidate's answers, one row per detail */}
      <dl className="divide-y rounded-xl border text-sm">
        {report.details.map((d) => (
          <div key={d.key} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[14rem_1fr]">
            <dt className="text-muted-foreground">{d.label}</dt>
            <dd className={d.value ? "font-medium" : "italic text-muted-foreground"}>{d.value ?? "Not answered"}</dd>
          </div>
        ))}
      </dl>

      {report.concerns.length > 0 && <ListBox title="Points to check" items={report.concerns} />}

      <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        These details were written down by AI from the call. Please confirm important ones (like salary) with the
        candidate. Written by {call.model_version ?? "the AI model"}.
      </p>
    </div>
  );
}

// Old format (earlier test calls): a score for each answer
function ScoredReportView({ call, report }: { call: ScreeningCall; report: ScreeningReport }) {
  const recommendation = recommendationStyles[report.recommendation ?? "maybe"] ?? recommendationStyles.maybe;
  const answers = report.answers ?? [];
  return (
    <div className="space-y-5 border-t pt-5">
      <div className="flex flex-wrap items-center gap-4">
        <ScoreRing score={call.overall_score ?? 0} size={72} stroke={7} />
        <div className="space-y-1.5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-indigo-600" /> Call report
          </h3>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${recommendation.className}`}>
            {recommendation.text}
          </span>
        </div>
      </div>

      {report.summary && <p className="text-sm leading-relaxed">{report.summary}</p>}

      {/* Warn HR if the candidate didn't answer every question */}
      {report.answered_count !== undefined && report.answered_count < answers.length && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Incomplete call: {report.answered_count} of {answers.length} questions answered. The score only reflects
          the answered questions, so consider this before deciding.
        </p>
      )}

      {/* One box per question: score bar, answer, reason */}
      <div className="space-y-3">
        {answers.map((a, i) => (
          <div key={i} className="rounded-xl border p-4 text-sm">
            <div className="flex justify-between gap-3">
              <p className="font-medium">
                {i + 1}. {a.question}
              </p>
              <span className="shrink-0 font-semibold">{a.score} / 10</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-linear-to-r from-indigo-600 to-violet-600"
                style={{ width: `${a.score * 10}%` }}
              />
            </div>
            <p className="mt-2">
              <span className="text-muted-foreground">Answer: </span>
              {a.answer_summary}
            </p>
            {a.comment && <p className="mt-1 text-xs text-muted-foreground">{a.comment}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ListBox title="Strengths" items={report.strengths ?? []} />
        <ListBox title="Concerns" items={report.concerns} />
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        This report is an AI recommendation to help HR. It is not a hiring decision. Written by{" "}
        {call.model_version ?? "the AI model"}.
      </p>
    </div>
  );
}

// The candidate's interview link: copy it, or make a new one
function InviteBox({
  candidate,
  invite,
  onCreated,
}: {
  candidate: CandidateDetail;
  invite: ScreeningInvite | null;
  onCreated: (invite: ScreeningInvite) => void;
}) {
  const [busy, setBusy] = useState(false);
  const link = invite ? `${window.location.origin}/interview/${invite.token}` : "";
  const label = invite ? (inviteLabels[invite.status] ?? inviteLabels.cancelled) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  }

  async function makeNew() {
    if (invite?.status === "pending" && !window.confirm("Make a new link? The current link will stop working.")) return;
    setBusy(true);
    try {
      onCreated(await createInvite(candidate.id));
      toast.success("New interview link ready.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not make a new link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="size-4 text-indigo-600" /> Interview link
        </p>
        {invite && label && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${label.className}`}>
            {label.text}
            {invite.status === "pending" && ` · expires ${formatDateTime(invite.expires_at)}`}
          </span>
        )}
      </div>

      {invite ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm text-muted-foreground"
          />
          <button
            type="button"
            onClick={copy}
            disabled={invite.status !== "pending"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Copy className="size-4" /> Copy
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No interview link yet.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Send this link to the candidate. Emails come with Agent 3.</p>
        {candidate.status === "shortlisted" && (
          <button
            type="button"
            onClick={makeNew}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {invite ? "New link" : "Create link"}
          </button>
        )}
      </div>
    </div>
  );
}

function ListBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border p-4 text-sm">
      <p className="mb-2 font-semibold">{title}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">None listed.</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
