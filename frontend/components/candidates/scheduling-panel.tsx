"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, CheckCircle2, Copy, Hourglass, Loader2, Mail, Sparkles, Video, X } from "lucide-react";
import { toast } from "sonner";

import { EmailList } from "@/components/shared/email-list";
import {
  approveInterview,
  cancelInterview,
  getBookingLink,
  getCandidate,
  getEmails,
  getInterviews,
  getSlotSuggestions,
  type BookingLink,
  type CandidateDetail,
  type Interview,
  type OutboxEmail,
  type Slot,
  type SlotSuggestions,
} from "@/lib/api";

// Every time is shown in Pakistan time, whatever the computer's own clock says
const PK = "Asia/Karachi";

// "2026-11-16T14:00:00+05:00" → "Mon 16 Nov, 2:00 pm"
function slotTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: PK, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
}
// "...T14:45:00+05:00" → "2:45 pm"
function endTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: PK, hour: "numeric", minute: "2-digit", hour12: true });
}
// "2026-11-16" → "Mon 16 Nov"
function dayLabel(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const STATUS_TEXT: Record<string, { label: string; className: string }> = {
  awaiting_candidate: { label: "Waiting for the candidate to confirm", className: "text-amber-600" },
  scheduled: { label: "Scheduled · invites sent to the candidate and interviewer", className: "text-emerald-600" },
  cancelled: { label: "Cancelled", className: "text-muted-foreground" },
  completed: { label: "Completed", className: "text-muted-foreground" },
};

export function SchedulingPanel({
  candidate,
  onChange,
}: {
  candidate: CandidateDetail;
  onChange: (updated: CandidateDetail) => void; // the candidate's status can change (e.g. after a cancel)
}) {
  // ---------- 1. Memory ----------
  const [interviews, setInterviews] = useState<Interview[] | null>(null); // null = loading
  const [link, setLink] = useState<BookingLink | null>(null); // the candidate's booking link
  const [emails, setEmails] = useState<OutboxEmail[]>([]); // emails about this candidate
  const [suggestions, setSuggestions] = useState<SlotSuggestions | null>(null);
  const [finding, setFinding] = useState(false);
  const [problem, setProblem] = useState("");
  const [chosen, setChosen] = useState(0); // which slot HR picked (index in the "options" list)
  const [mode, setMode] = useState<"online" | "onsite">("online");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  // ---------- 2. Load this candidate's interviews, booking link and emails ----------
  // (runs again whenever the candidate's status changes, e.g. after approving or cancelling)
  useEffect(() => {
    Promise.all([getInterviews(candidate.id), getBookingLink(candidate.id), getEmails(candidate.id)])
      .then(([list, bookingLink, emailList]) => {
        setInterviews(list);
        setLink(bookingLink);
        setEmails(emailList);
      })
      .catch(() => setInterviews([]));
  }, [candidate.id, candidate.status]);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/book/${link.token}`);
      toast.success("Booking link copied");
    } catch {
      toast.error("Could not copy. Please select the link and copy it yourself.");
    }
  }

  const active = interviews?.find((i) => i.status === "awaiting_candidate" || i.status === "scheduled");
  const past = (interviews ?? []).filter((i) => i !== active);

  // Only shown once HR has invited the candidate to an interview (or there is interview history)
  if (!interviews || (candidate.status !== "interview_invited" && interviews.length === 0)) return null;

  // The slots HR can choose from: Agent 3's best first, then the backups
  const options: Slot[] = suggestions ? [...(suggestions.best ? [suggestions.best] : []), ...suggestions.backups] : [];

  // ---------- 3. Actions ----------
  async function findTimes() {
    setFinding(true);
    setProblem("");
    try {
      const result = await getSlotSuggestions(candidate.id);
      setSuggestions(result);
      setChosen(0);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not find interview times.");
    } finally {
      setFinding(false);
    }
  }

  async function approve() {
    const slot = options[chosen];
    if (!slot || !suggestions) return;
    if (mode === "onsite" && !address.trim()) {
      setProblem("Please enter the office address for an on-site interview.");
      return;
    }
    setSaving(true);
    setProblem("");
    try {
      const isBest = suggestions.best !== null && chosen === 0;
      await approveInterview(candidate.id, {
        interviewer_id: slot.interviewer_id,
        start: slot.start,
        mode,
        location: mode === "onsite" ? address.trim() : null,
        reason: isBest ? suggestions.reason : "HR chose another free time",
        candidate_windows: suggestions.availability.windows,
      });
      setSuggestions(null);
      toast.success("Interview scheduled. The emails to the candidate and interviewer are in the Outbox.");
      // The candidate is now "interview scheduled": reloading them also reloads this box
      onChange(await getCandidate(candidate.id));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not approve the interview.");
    } finally {
      setSaving(false);
    }
  }

  async function cancel(interview: Interview) {
    if (!window.confirm("Cancel this interview? The time slot becomes free again.")) return;
    try {
      const updated = await cancelInterview(interview.id);
      setInterviews((interviews ?? []).map((i) => (i.id === updated.id ? updated : i)));
      setLink(null);
      toast.success("Interview cancelled. Cancellation emails are in the Outbox.");
      onChange(await getCandidate(candidate.id)); // "scheduled" → back to "invited", ready for a new time
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel the interview.");
    }
  }

  // ---------- 4. What the panel shows ----------
  return (
    <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-xs">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <CalendarClock className="size-5 text-indigo-600" /> Interview scheduling
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          Agent 3
        </span>
      </h2>

      {/* A) There is an active interview: show it */}
      {active && (
        <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">
                {slotTime(active.start_at)} – {endTime(active.end_at)}
              </p>
              <p className="text-sm text-muted-foreground">with {active.interviewer_name}</p>
            </div>
            <button
              onClick={() => cancel(active)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-4" /> Cancel
            </button>
          </div>
          <p className="flex items-center gap-2 text-sm">
            {active.mode === "online" ? <Video className="size-4 text-indigo-600" /> : <Building2 className="size-4 text-indigo-600" />}
            {active.mode === "online" ? "Online" : "On-site"}: <span className="break-all text-muted-foreground">{active.location}</span>
          </p>
          <p className={`flex items-center gap-2 text-sm font-medium ${STATUS_TEXT[active.status]?.className ?? ""}`}>
            {active.status === "scheduled" ? <CheckCircle2 className="size-4" /> : <Hourglass className="size-4" />}
            {STATUS_TEXT[active.status]?.label ?? active.status}
          </p>
          {active.ai_reason && <p className="text-xs text-muted-foreground">Why this time: {active.ai_reason}</p>}

          {/* The candidate's "change time" link (it is also in their email) */}
          {link?.status === "pending" && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs text-muted-foreground">
                {active.status === "scheduled"
                  ? "The candidate's email has this link, so they can choose another free time once if they can't make it:"
                  : "Send this link to the candidate. They can confirm this time or choose another free time:"}
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${typeof window === "undefined" ? "" : window.location.origin}/book/${link.token}`}
                  onFocus={(e) => e.target.select()}
                  aria-label="Booking link"
                  className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-xs"
                />
                <button
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
                >
                  <Copy className="size-4" /> Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* B) No active interview yet: Agent 3 finds a time, HR approves */}
      {!active && candidate.status === "interview_invited" && (
        <>
          {!suggestions && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Agent 3 compares the times the candidate gave on the call with your interviewers&apos; free time.
              </p>
              <button
                onClick={findTimes}
                disabled={finding}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-60"
              >
                {finding ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {finding ? "Finding times…" : "Find interview time"}
              </button>
            </div>
          )}

          {suggestions && (
            <div className="space-y-5">
              {/* What the candidate asked for */}
              <div className="space-y-1 rounded-xl bg-muted/60 p-4 text-sm">
                <p>
                  <span className="font-medium">Candidate said: </span>
                  {suggestions.availability.source_text ? `“${suggestions.availability.source_text}”` : "No times given"}
                </p>
                {suggestions.availability.windows.length > 0 && (
                  <p>
                    <span className="font-medium">Understood as: </span>
                    {suggestions.availability.windows.map((w) => `${dayLabel(w.day)} ${w.start}–${w.end}`).join(" · ")}
                  </p>
                )}
                {suggestions.availability.flexible && <p className="font-medium">The candidate is flexible.</p>}
              </div>

              {/* Agent 3's decision */}
              <div
                className={`flex gap-2 rounded-xl p-3 text-sm ${
                  suggestions.best
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                }`}
              >
                {suggestions.best ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
                <p>
                  {suggestions.reason}
                  {(suggestions.status === "no_interviewers" || suggestions.status === "no_free_time") && (
                    <>
                      {" "}
                      <Link href="/interviewers" className="font-semibold underline">
                        Open Interviewers
                      </Link>
                    </>
                  )}
                </p>
              </div>

              {/* The slots to choose from */}
              {options.length > 0 && (
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-semibold">Choose the interview time</legend>
                  {options.map((slot, index) => (
                    <label
                      key={`${slot.interviewer_id}-${slot.start}`}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${
                        chosen === index ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <input type="radio" name="slot" checked={chosen === index} onChange={() => setChosen(index)} className="accent-indigo-600" />
                      <span className="flex-1">
                        <span className="font-medium">
                          {slotTime(slot.start)} – {endTime(slot.end)}
                        </span>
                        <span className="text-muted-foreground"> · {slot.interviewer_name}</span>
                      </span>
                      {suggestions.best && index === 0 && (
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">Agent 3&apos;s pick</span>
                      )}
                    </label>
                  ))}
                </fieldset>
              )}

              {/* Online or on-site */}
              {options.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Interview type</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="mode" checked={mode === "online"} onChange={() => setMode("online")} className="accent-indigo-600" />
                      Online (the interviewer&apos;s meeting link)
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="mode" checked={mode === "onsite"} onChange={() => setMode("onsite")} className="accent-indigo-600" />
                      On-site
                    </label>
                  </div>
                  {mode === "onsite" && (
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Office address, e.g. 3rd floor, Arfa Tower, Lahore"
                      className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
                    />
                  )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <button onClick={() => setSuggestions(null)} className="h-10 rounded-full border px-5 text-sm font-medium hover:bg-muted">
                  Close
                </button>
                <button onClick={findTimes} disabled={finding} className="h-10 rounded-full border px-5 text-sm font-medium hover:bg-muted disabled:opacity-60">
                  {finding ? "Checking…" : "Check again"}
                </button>
                {options.length > 0 && (
                  <button
                    onClick={approve}
                    disabled={saving}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Approve &amp; send invites
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Problem message */}
      {problem && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{problem}</div>}

      {/* Earlier (cancelled / completed) interviews */}
      {past.length > 0 && (
        <div className="border-t pt-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Earlier</p>
          <ul className="mt-2 space-y-1 text-sm">
            {past.map((i) => (
              <li key={i.id} className="text-muted-foreground">
                {slotTime(i.start_at)} · {i.interviewer_name} · {STATUS_TEXT[i.status]?.label ?? i.status}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The emails about this candidate (invites, changes, cancellations) */}
      {emails.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Mail className="size-3.5" /> Emails ({emails.length})
          </p>
          <EmailList
            emails={emails}
            onChange={(updated) => setEmails((list) => list.map((e) => (e.id === updated.id ? updated : e)))}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        All times are Pakistan time. Agent 3 suggests; nothing is booked until you approve. Approving sends the
        interview emails with a calendar invite to the candidate and the interviewer.
      </p>
    </section>
  );
}
