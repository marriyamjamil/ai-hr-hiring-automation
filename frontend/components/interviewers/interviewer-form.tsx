"use client";

import { useState } from "react";
import { CalendarOff, Clock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createInterviewer,
  updateInterviewer,
  type AvailabilitySlot,
  type Interviewer,
  type InterviewerInput,
  type Job,
} from "@/lib/api";

// 0 = Monday ... 6 = Sunday (the same numbers the backend uses)
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type TimeOffRow = { start_date: string; end_date: string; reason: string };

const inputClass =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10";

// Today as "YYYY-MM-DD" in the user's own time zone
export function todayText() {
  return new Date().toLocaleDateString("en-CA");
}

// The same checks as the backend, so HR sees the problem before saving
function findProblem(meetingLink: string, slots: AvailabilitySlot[], timeOff: TimeOffRow[]): string {
  if (meetingLink.trim() && !/^https?:\/\//.test(meetingLink.trim())) {
    return "The meeting link must start with https://";
  }
  for (const s of slots) {
    if (!s.start_time || !s.end_time || s.end_time <= s.start_time) {
      return `${WEEKDAYS[s.weekday]}: the end time must be after the start time.`;
    }
  }
  // Sort by day, then start time: an overlap is when a block starts before the previous one ends
  const sorted = [...slots].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
  for (let i = 1; i < sorted.length; i++) {
    const before = sorted[i - 1];
    const after = sorted[i];
    if (before.weekday === after.weekday && after.start_time < before.end_time) {
      return `${WEEKDAYS[after.weekday]}: two time blocks overlap.`;
    }
  }
  for (const t of timeOff) {
    if (!t.start_date || !t.end_date) return "Please fill in both dates for each day off.";
    if (t.end_date < t.start_date) return "A day off can't end before it starts.";
  }
  return "";
}

export function InterviewerForm({
  interviewer,
  jobs,
  onSaved,
  onCancel,
}: {
  interviewer: Interviewer | null; // null = adding a new one
  jobs: Job[];
  onSaved: (saved: Interviewer) => void;
  onCancel: () => void;
}) {
  // ---------- 1. The form's memory (filled with the interviewer's values when editing) ----------
  const [name, setName] = useState(interviewer?.name ?? "");
  const [email, setEmail] = useState(interviewer?.email ?? "");
  const [jobTitle, setJobTitle] = useState(interviewer?.job_title ?? "");
  const [meetingLink, setMeetingLink] = useState(interviewer?.meeting_link ?? "");
  const [isActive, setIsActive] = useState(interviewer?.is_active ?? true);
  const [jobIds, setJobIds] = useState<number[]>(interviewer?.jobs.map((j) => j.id) ?? []);
  const [slots, setSlots] = useState<AvailabilitySlot[]>(
    interviewer?.availability.map((s) => ({ weekday: s.weekday, start_time: s.start_time, end_time: s.end_time })) ?? [
      { weekday: 0, start_time: "10:00", end_time: "13:00" },
    ],
  );
  const [timeOff, setTimeOff] = useState<TimeOffRow[]>(
    interviewer?.time_off.map((t) => ({ start_date: t.start_date, end_date: t.end_date, reason: t.reason ?? "" })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");

  // Closed jobs are hidden, unless this interviewer is already linked to one
  const visibleJobs = jobs.filter((j) => j.status !== "closed" || jobIds.includes(j.id));

  // ---------- 2. Small helpers to change one row ----------
  function toggleJob(id: number) {
    setJobIds(jobIds.includes(id) ? jobIds.filter((j) => j !== id) : [...jobIds, id]);
  }
  function changeSlot(index: number, change: Partial<AvailabilitySlot>) {
    setSlots(slots.map((s, i) => (i === index ? { ...s, ...change } : s)));
  }
  function changeTimeOff(index: number, change: Partial<TimeOffRow>) {
    setTimeOff(timeOff.map((t, i) => (i === index ? { ...t, ...change } : t)));
  }

  // ---------- 3. Save ----------
  async function save() {
    const found = findProblem(meetingLink, slots, timeOff);
    if (found) {
      setProblem(found);
      return;
    }
    setProblem("");
    setSaving(true);

    const data: InterviewerInput = {
      name: name.trim(),
      email: email.trim(),
      job_title: jobTitle.trim() || null,
      meeting_link: meetingLink.trim() || null,
      is_active: isActive,
      job_ids: jobIds,
      availability: slots,
      time_off: timeOff.map((t) => ({ start_date: t.start_date, end_date: t.end_date, reason: t.reason.trim() || null })),
    };

    try {
      const saved = interviewer ? await updateInterviewer(interviewer.id, data) : await createInterviewer(data);
      toast.success(interviewer ? "Interviewer updated" : "Interviewer added");
      onSaved(saved);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not save the interviewer.");
    } finally {
      setSaving(false);
    }
  }

  // ---------- 4. What the form shows ----------
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault(); // stop the browser reloading the page
        save();
      }}
      className="space-y-6 rounded-2xl border bg-card p-6 shadow-xs"
    >
      <h2 className="font-display text-xl font-bold">{interviewer ? `Edit ${interviewer.name}` : "Add an interviewer"}</h2>

      {/* Basic details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">
          Name *
          <input className={inputClass} required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sara Khan" />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Email *
          <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sara@company.com" />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Job title
          <input className={inputClass} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Senior Developer" />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Meeting link (for online interviews)
          <input className={inputClass} value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 accent-indigo-600" />
        Active (Agent 3 can book interviews with this person)
      </label>

      {/* Jobs */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Jobs they interview for</p>
        {visibleJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet. Create a job first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {visibleJobs.map((job) => {
              const chosen = jobIds.includes(job.id);
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => toggleJob(job.id)}
                  aria-pressed={chosen}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    chosen
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "bg-background text-muted-foreground hover:border-indigo-300 hover:text-foreground"
                  }`}
                >
                  {job.title}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Weekly free time */}
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4 text-indigo-600" /> Weekly free time <span className="font-normal text-muted-foreground">(Pakistan time)</span>
        </p>
        {slots.length === 0 && <p className="text-sm text-muted-foreground">No free time added: Agent 3 can't book this person.</p>}
        {slots.map((slot, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Day"
              className={`${inputClass} w-36`}
              value={slot.weekday}
              onChange={(e) => changeSlot(index, { weekday: Number(e.target.value) })}
            >
              {WEEKDAYS.map((day, i) => (
                <option key={day} value={i}>
                  {day}
                </option>
              ))}
            </select>
            <input aria-label="From" type="time" className={`${inputClass} w-32`} value={slot.start_time} onChange={(e) => changeSlot(index, { start_time: e.target.value })} />
            <span className="text-sm text-muted-foreground">to</span>
            <input aria-label="To" type="time" className={`${inputClass} w-32`} value={slot.end_time} onChange={(e) => changeSlot(index, { end_time: e.target.value })} />
            <button
              type="button"
              onClick={() => setSlots(slots.filter((_, i) => i !== index))}
              aria-label="Remove this time"
              className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSlots([...slots, { weekday: 0, start_time: "10:00", end_time: "13:00" }])}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
        >
          <Plus className="size-4" /> Add time
        </button>
      </div>

      {/* Days off */}
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <CalendarOff className="size-4 text-indigo-600" /> Days off <span className="font-normal text-muted-foreground">(leave, holidays)</span>
        </p>
        {timeOff.map((row, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input aria-label="First day off" type="date" className={`${inputClass} w-40`} value={row.start_date} onChange={(e) => changeTimeOff(index, { start_date: e.target.value })} />
            <span className="text-sm text-muted-foreground">to</span>
            <input aria-label="Last day off" type="date" className={`${inputClass} w-40`} value={row.end_date} onChange={(e) => changeTimeOff(index, { end_date: e.target.value })} />
            <input aria-label="Reason" className={`${inputClass} w-48`} value={row.reason} onChange={(e) => changeTimeOff(index, { reason: e.target.value })} placeholder="Reason (optional)" />
            <button
              type="button"
              onClick={() => setTimeOff(timeOff.filter((_, i) => i !== index))}
              aria-label="Remove these days off"
              className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setTimeOff([...timeOff, { start_date: todayText(), end_date: todayText(), reason: "" }])}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
        >
          <Plus className="size-4" /> Add days off
        </button>
      </div>

      {/* Problem message */}
      {problem && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{problem}</div>}

      {/* Buttons */}
      <div className="flex justify-end gap-2 border-t pt-4">
        <button type="button" onClick={onCancel} className="h-10 rounded-full border px-5 text-sm font-medium hover:bg-muted">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {interviewer ? "Save changes" : "Add interviewer"}
        </button>
      </div>
    </form>
  );
}
