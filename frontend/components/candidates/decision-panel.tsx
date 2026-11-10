"use client";

import { useState } from "react";
import { CalendarCheck, CheckCircle2, History, Loader2, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/status-badge";
import { decideCandidate, type CandidateDetail } from "@/lib/api";

type Choice = "shortlisted" | "rejected" | "undo" | "interview_invited";

// Which buttons make sense for each status (same rules as the backend's state machine)
function allowedChoices(status: string): Choice[] {
  if (status === "scored" || status === "needs_manual_review") return ["shortlisted", "rejected"];
  if (status === "shortlisted") return ["rejected", "undo"];
  if (status === "screened") return ["interview_invited", "rejected"];
  if (status === "interview_invited") return ["rejected", "undo"];
  if (status === "rejected") return ["undo"];
  return []; // e.g. resume_received or screening_in_progress
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// HR's decision box + the decision history, shown on the candidate page
export function DecisionPanel({
  candidate,
  onChange,
}: {
  candidate: CandidateDetail;
  onChange: (updated: CandidateDetail) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<Choice | null>(null);

  const choices = allowedChoices(candidate.status);

  async function decide(choice: Choice) {
    // Friendly check first (the backend checks again)
    if (choice === "rejected" && !reason.trim()) {
      toast.error("Please write a job-related reason before rejecting.");
      return;
    }
    setBusy(choice);
    try {
      const updated = await decideCandidate(candidate.id, choice, reason.trim() || undefined);
      onChange(updated); // the page shows the new status + history straight away
      setReason("");
      const messages = {
        shortlisted: "Candidate shortlisted.",
        rejected: "Candidate rejected.",
        undo: "Decision undone.",
        interview_invited: "Candidate invited to interview.",
      };
      toast.success(messages[choice]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the decision.");
    } finally {
      setBusy(null);
    }
  }

  const buttonBase = "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60";

  return (
    <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-xs">
      {/* ---------- The decision ---------- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-bold">Your decision</h2>
          <StatusBadge status={candidate.status} />
        </div>

        {choices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {candidate.status === "screening_in_progress"
              ? "A screening call is in progress. You can decide after the call."
              : "No decision is possible yet. The CV is still being processed."}
          </p>
        ) : (
          <>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required to reject), e.g. 'Less than 1 year of Python experience'"
              className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
            />
            <div className="flex flex-wrap gap-2">
              {choices.includes("shortlisted") && (
                <button
                  type="button"
                  onClick={() => decide("shortlisted")}
                  disabled={busy !== null}
                  className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`}
                >
                  {busy === "shortlisted" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Shortlist for screening
                </button>
              )}
              {choices.includes("interview_invited") && (
                <button
                  type="button"
                  onClick={() => decide("interview_invited")}
                  disabled={busy !== null}
                  className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`}
                >
                  {busy === "interview_invited" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CalendarCheck className="size-4" />
                  )}
                  Invite to interview
                </button>
              )}
              {choices.includes("rejected") && (
                <button
                  type="button"
                  onClick={() => decide("rejected")}
                  disabled={busy !== null}
                  className={`${buttonBase} border border-destructive/30 text-destructive hover:bg-destructive/10`}
                >
                  {busy === "rejected" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                  Reject
                </button>
              )}
              {choices.includes("undo") && (
                <button
                  type="button"
                  onClick={() => decide("undo")}
                  disabled={busy !== null}
                  className={`${buttonBase} border hover:bg-muted`}
                >
                  {busy === "undo" ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
                  Undo last decision
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---------- History (the audit trail): newest first ---------- */}
      {candidate.decisions.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4" /> History
          </h3>
          <ol className="space-y-3">
            {[...candidate.decisions].reverse().map((d) => (
              <li key={d.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo-500" />
                <div>
                  <p>
                    {d.from_status === d.to_status ? (
                      <span className="font-semibold">CV updated</span> // same status: a new CV, not a decision
                    ) : (
                      <>
                        <span className="capitalize">{d.from_status.replaceAll("_", " ")}</span> →{" "}
                        <span className="font-semibold capitalize">{d.to_status.replaceAll("_", " ")}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">
                      {" "}
                      · by {d.decided_by_name ?? "the system"} · {formatDateTime(d.created_at)}
                    </span>
                  </p>
                  {d.reason && <p className="text-muted-foreground">&ldquo;{d.reason}&rdquo;</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
