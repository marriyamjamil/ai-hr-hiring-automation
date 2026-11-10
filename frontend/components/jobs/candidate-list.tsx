"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Lightbulb, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { ScoreRing } from "@/components/shared/score-ring";
import { StatusBadge } from "@/components/shared/status-badge";
import { approveShortlist, getJobCandidates, getShortlistSuggestion, type CandidateSummary } from "@/lib/api";

const filters = [
  { value: "all", label: "All" },
  { value: "scored", label: "Scored" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "screened", label: "Screened" },
  { value: "interview_invited", label: "Interview" },
  { value: "interview_scheduled", label: "Scheduled" },
  { value: "rejected", label: "Rejected" },
  { value: "needs_manual_review", label: "Needs review" },
];

// Only these candidates can still be shortlisted (same rule as the backend)
const SELECTABLE = new Set(["scored", "needs_manual_review"]);

// Turn a score into a friendly label (same colours as the ScoreRing)
function matchLabel(score: number) {
  if (score >= 75) return { text: "Strong match", className: "text-emerald-600" };
  if (score >= 50) return { text: "Possible match", className: "text-indigo-600" };
  return { text: "Weak match", className: "text-amber-600" };
}

export function CandidateList({ jobId, refreshKey }: { jobId: number; refreshKey: number }) {
  const [candidates, setCandidates] = useState<CandidateSummary[] | null>(null); // null = loading
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [reloadKey, setReloadKey] = useState(0); // +1 after approving a shortlist → reload

  // Shortlist controls
  const [top, setTop] = useState(10); // "suggest the top 10"
  const [minScore, setMinScore] = useState(60); // "…with a score of at least 60"
  const [selected, setSelected] = useState<Set<number>>(new Set()); // ticked candidate ids
  const [suggesting, setSuggesting] = useState(false);
  const [approving, setApproving] = useState(false);

  // Load the ranked list when the page opens, after an upload (refreshKey) and after a shortlist (reloadKey)
  useEffect(() => {
    getJobCandidates(jobId) // GET /api/jobs/{id}/candidates (already sorted, best first)
      .then(setCandidates)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load candidates."));
  }, [jobId, refreshKey, reloadKey]);

  const visible = (candidates ?? []).filter((c) => filter === "all" || c.status === filter);

  // Tick or untick one candidate
  function toggle(id: number) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 💡 Ask the backend for the top N above the minimum score, and tick them
  async function handleSuggest() {
    setSuggesting(true);
    try {
      const suggestion = await getShortlistSuggestion(jobId, top, minScore);
      setSelected(new Set(suggestion.map((c) => c.id)));
      setFilter("all");
      if (suggestion.length === 0) toast.info(`Nobody scored ${minScore} or more. Try a lower minimum score.`);
      else toast.success(`${suggestion.length} candidate${suggestion.length > 1 ? "s" : ""} ticked. Review them, then approve.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not get a suggestion.");
    } finally {
      setSuggesting(false);
    }
  }

  // ✅ HR approves the ticked candidates (the human decision)
  async function handleApprove() {
    if (selected.size === 0) return;
    setApproving(true);
    try {
      const result = await approveShortlist(jobId, [...selected]);
      toast.success(`${result.shortlisted} candidate${result.shortlisted === 1 ? "" : "s"} shortlisted for screening.`);
      result.skipped.forEach((message) => toast.warning(message));
      setSelected(new Set());
      setReloadKey((key) => key + 1); // reload so the new statuses show
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve the shortlist.");
    } finally {
      setApproving(false);
    }
  }

  const hasSelectable = (candidates ?? []).some((c) => SELECTABLE.has(c.status));
  const numberInput = "h-9 w-16 rounded-lg border bg-background px-2 text-center text-sm";

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-xs">
      {/* ---------- Header + filter tabs ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Candidates {candidates && `(${candidates.length})`}</h2>
          <p className="text-sm text-muted-foreground">Ranked by AI score, highest first. The AI suggests, you decide.</p>
        </div>
        {candidates && candidates.length > 0 && (
          <div className="flex gap-1 overflow-x-auto rounded-xl border bg-background p-1 no-scrollbar">
            {filters.map((f) => {
              const count = f.value === "all" ? candidates.length : candidates.filter((c) => c.status === f.value).length;
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f.label} <span className="text-xs opacity-80">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Shortlist panel: suggest top N, review ticks, approve ---------- */}
      {hasSelectable && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm dark:border-indigo-500/20 dark:bg-indigo-500/5">
          <Lightbulb className="size-4 text-indigo-600" />
          <span>Suggest the top</span>
          <input
            type="number"
            min={1}
            max={100}
            aria-label="How many to suggest"
            className={numberInput}
            value={top}
            onChange={(e) => setTop(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
          />
          <span>with a score of at least</span>
          <input
            type="number"
            min={0}
            max={100}
            aria-label="Minimum score"
            className={numberInput}
            value={minScore}
            onChange={(e) => setMinScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          />
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-4 font-semibold hover:bg-muted disabled:opacity-60"
          >
            {suggesting ? <Loader2 className="size-4 animate-spin" /> : <Lightbulb className="size-4" />} Suggest
          </button>

          <button
            type="button"
            onClick={handleApprove}
            disabled={approving || selected.size === 0}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-4 font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:shadow-none"
          >
            {approving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Approve shortlist ({selected.size})
          </button>
        </div>
      )}

      {/* ---------- Error / loading / empty ---------- */}
      {error && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {!candidates && !error && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {candidates && visible.length === 0 && (
        <div className="flex flex-col items-center py-10 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="mt-2 font-semibold">{candidates.length ? "No candidates in this filter" : "No candidates yet"}</p>
          <p className="text-sm text-muted-foreground">{candidates.length ? "Try another tab." : "Upload CVs above to get started."}</p>
        </div>
      )}

      {/* ---------- One row per candidate ---------- */}
      <div className="space-y-2">
        {visible.map((candidate) => {
          // The rank number comes from the FULL list, so #1 stays #1 even when a filter is on
          const rank = (candidates ?? []).indexOf(candidate) + 1;
          const score = candidate.overall_score;
          const selectable = SELECTABLE.has(candidate.status);
          const ticked = selected.has(candidate.id);
          return (
            <div
              key={candidate.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                ticked ? "border-indigo-300 bg-indigo-50/60 dark:bg-indigo-500/10" : ""
              }`}
            >
              {/* The tick box sits OUTSIDE the link, so ticking doesn't open the candidate page */}
              <input
                type="checkbox"
                aria-label={`Select ${candidate.name}`}
                className="size-4 shrink-0 accent-indigo-600 disabled:opacity-30"
                checked={ticked}
                disabled={!selectable}
                onChange={() => toggle(candidate.id)}
              />

              <Link href={`/candidates/${candidate.id}`} className="group flex min-w-0 flex-1 items-center gap-4">
                <span className="w-8 text-center font-display font-bold text-muted-foreground">{score !== null ? `#${rank}` : "—"}</span>

                {score !== null ? (
                  <ScoreRing score={score} size={52} stroke={5} />
                ) : (
                  <span className="flex size-13 items-center justify-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-500/10">
                    <AlertTriangle className="size-5" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold group-hover:text-primary">{candidate.name}</p>
                    {score !== null && candidate.status === "scored" ? (
                      <span className={`text-xs font-semibold ${matchLabel(score).className}`}>{matchLabel(score).text}</span>
                    ) : (
                      <StatusBadge status={candidate.status} />
                    )}
                  </div>
                  {candidate.email && <p className="truncate text-xs text-muted-foreground">{candidate.email}</p>}
                  {candidate.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{candidate.summary}</p>}
                </div>

                <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
