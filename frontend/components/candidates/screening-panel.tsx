"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Info, Loader2, PhoneCall, PhoneOff, RefreshCw, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { ScoreRing } from "@/components/shared/score-ring";
import {
  cancelScreeningCall,
  getScreeningCalls,
  replyToScreeningCall,
  retryScreeningReport,
  startScreeningCall,
  type CandidateDetail,
  type ScreeningCall,
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Agent 2's screening call on the candidate page: start it, chat, and read the report
export function ScreeningPanel({ candidate, onChange }: { candidate: CandidateDetail; onChange: () => void }) {
  const [calls, setCalls] = useState<ScreeningCall[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [answer, setAnswer] = useState(""); // what HR types as the candidate's answer
  const [busy, setBusy] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null); // a "handle" to the chat box, to scroll it

  // Load this candidate's calls once
  useEffect(() => {
    getScreeningCalls(candidate.id)
      .then(setCalls)
      .catch(() => toast.error("Could not load the screening calls."))
      .finally(() => setLoaded(true));
  }, [candidate.id]);

  const call = calls.at(-1); // the latest call (the list is oldest first)

  // Keep the newest message in view (like WhatsApp)
  useEffect(() => {
    const box = chatRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [call?.transcript.length, busy]);

  // Put the updated call from the backend into the list (replacing the old copy)
  function saveCall(updated: ScreeningCall) {
    setCalls((previous) => [...previous.filter((c) => c.id !== updated.id), updated]);
  }

  // One helper for every button: spinner, API call, error message
  async function run(action: () => Promise<ScreeningCall>, success?: string) {
    setBusy(true);
    try {
      const updated = await action();
      saveCall(updated);
      if (success) toast.success(success);
      return updated;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const started = await run(() => startScreeningCall(candidate.id), "Screening call started.");
    if (started) onChange(); // the candidate's status changed → reload the page data
  }

  async function send() {
    const text = answer.trim();
    if (!text || !call) return;
    const updated = await run(() => replyToScreeningCall(call.id, text));
    if (!updated) return;
    setAnswer("");
    if (updated.status !== "in_progress") onChange(); // the call ended → status changed
  }

  async function cancel() {
    if (!call) return;
    if (!window.confirm("End this call? The candidate goes back to 'shortlisted'.")) return;
    const ended = await run(() => cancelScreeningCall(call.id), "Call ended.");
    if (ended) onChange();
  }

  async function retry() {
    if (!call) return;
    await run(() => retryScreeningReport(call.id), "Report ready.");
  }

  // Nothing to show: no calls yet and the candidate is not shortlisted
  if (!loaded) return null;
  if (!call && candidate.status !== "shortlisted") return null;

  const canStart = candidate.status === "shortlisted" && call?.status !== "in_progress";

  return (
    <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-xs">
      {/* ---------- Title + Start button ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <PhoneCall className="size-4 text-indigo-600" /> Screening call (Agent 2)
          </h2>
          <p className="text-sm text-muted-foreground">
            Text mode: you type the candidate&apos;s answers to try the call. Voice calls come later.
          </p>
        </div>
        {canStart && (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
            {call ? "Start a new call" : "Start screening call"}
          </button>
        )}
      </div>

      {call && (
        <>
          <p className="text-xs text-muted-foreground">
            Call #{call.id} · {callStatusLabels[call.status] ?? call.status} · started {formatDateTime(call.started_at)}
          </p>

          {/* ---------- The conversation ---------- */}
          <div ref={chatRef} className="max-h-96 space-y-3 overflow-y-auto rounded-xl border bg-muted/30 p-4">
            {call.transcript.map((message, i) => (
              <Bubble key={i} message={message} />
            ))}
            {busy && call.status === "in_progress" && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Agent is thinking…
              </p>
            )}
          </div>

          {/* ---------- Typing box (only while the call is running) ---------- */}
          {call.status === "in_progress" && (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends, Shift+Enter makes a new line
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={busy}
                placeholder="Type the candidate's answer… (Enter to send, Shift+Enter for a new line)"
                className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
              />
              <div className="flex flex-wrap justify-between gap-2">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-destructive/30 px-4 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                >
                  <PhoneOff className="size-4" /> End call
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || !answer.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Send className="size-4" /> Send answer
                </button>
              </div>
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

// The report GPT wrote after the call
function ReportView({ call, report }: { call: ScreeningCall; report: ScreeningReport }) {
  const recommendation = recommendationStyles[report.recommendation] ?? recommendationStyles.maybe;
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

      {/* One box per question: score bar, answer, reason */}
      <div className="space-y-3">
        {report.answers.map((a, i) => (
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
        <ListBox title="Strengths" items={report.strengths} />
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
