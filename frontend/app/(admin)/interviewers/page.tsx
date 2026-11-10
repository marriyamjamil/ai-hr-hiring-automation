"use client";

import { useEffect, useState } from "react";
import { CalendarOff, Clock, Mail, Pencil, Plus, Trash2, UserRound, Video } from "lucide-react";
import { toast } from "sonner";

import { InterviewerForm, todayText, WEEKDAYS } from "@/components/interviewers/interviewer-form";
import { deleteInterviewer, getInterviewers, getJobs, type Interviewer, type Job } from "@/lib/api";

// "2026-11-20" → "20 Nov"
function shortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function InterviewersPage() {
  // ---------- 1. The page's memory ----------
  const [interviewers, setInterviewers] = useState<Interviewer[] | null>(null); // null = loading
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  // What the form is showing: nothing (null), a new interviewer ("new"), or one to edit
  const [editing, setEditing] = useState<Interviewer | "new" | null>(null);

  // ---------- 2. Load interviewers + jobs once ----------
  useEffect(() => {
    Promise.all([getInterviewers(), getJobs()])
      .then(([interviewerList, jobList]) => {
        setInterviewers(interviewerList);
        setJobs(jobList);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load interviewers."));
  }, []);

  // ---------- 3. After saving: put the new or updated interviewer in the list ----------
  function handleSaved(saved: Interviewer) {
    const list = interviewers ?? [];
    const exists = list.some((i) => i.id === saved.id);
    setInterviewers(exists ? list.map((i) => (i.id === saved.id ? saved : i)) : [...list, saved]);
    setEditing(null);
  }

  async function handleDelete(interviewer: Interviewer) {
    if (!window.confirm(`Delete ${interviewer.name}? This can't be undone.`)) return;
    try {
      await deleteInterviewer(interviewer.id);
      setInterviewers((interviewers ?? []).filter((i) => i.id !== interviewer.id));
      toast.success("Interviewer deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the interviewer.");
    }
  }

  const today = todayText();

  // ---------- 4. What the page shows ----------
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Interviewers</h1>
          <p className="mt-1 text-muted-foreground">Who takes interviews, for which jobs, and when they are free.</p>
        </div>
        {editing === null && (
          <button
            onClick={() => setEditing("new")}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.03]"
          >
            <Plus className="size-4" /> Add interviewer
          </button>
        )}
      </div>

      {/* The form (add or edit). The key makes a fresh form for each person. */}
      {editing !== null && (
        <InterviewerForm
          key={editing === "new" ? "new" : editing.id}
          interviewer={editing === "new" ? null : editing}
          jobs={jobs}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Error */}
      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {/* Loading */}
      {!interviewers && !error && (
        <div className="grid gap-5 md:grid-cols-2">
          {[1, 2].map((n) => (
            <div key={n} className="h-56 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {/* Empty */}
      {interviewers && interviewers.length === 0 && editing === null && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <UserRound className="size-8 text-muted-foreground" />
          <p className="mt-3 font-display text-lg font-bold">No interviewers yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add the people who take interviews and their free time. Agent 3 uses this to book interviews.
          </p>
        </div>
      )}

      {/* One card per interviewer */}
      {interviewers && interviewers.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {interviewers.map((person) => {
            const upcomingTimeOff = person.time_off.filter((t) => t.end_date >= today); // hide past leave
            return (
              <div key={person.id} className={`flex flex-col rounded-2xl border bg-card p-6 shadow-xs ${person.is_active ? "" : "opacity-60"}`}>
                {/* Name + buttons */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-display text-lg font-bold">{person.name}</h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          person.is_active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {person.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {person.job_title && <p className="text-sm text-muted-foreground">{person.job_title}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditing(person)}
                      aria-label={`Edit ${person.name}`}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(person)}
                      aria-label={`Delete ${person.name}`}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Contact */}
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="size-4 shrink-0" /> {person.email}
                  </p>
                  {person.meeting_link && (
                    <a href={person.meeting_link} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate hover:text-primary">
                      <Video className="size-4 shrink-0" /> {person.meeting_link}
                    </a>
                  )}
                </div>

                {/* Jobs */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {person.jobs.length === 0 ? (
                    <span className="text-xs text-orange-600">No jobs chosen yet</span>
                  ) : (
                    person.jobs.map((job) => (
                      <span key={job.id} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                        {job.title}
                      </span>
                    ))
                  )}
                </div>

                {/* Weekly free time */}
                <div className="mt-4 border-t pt-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <Clock className="size-3.5" /> Weekly free time
                  </p>
                  {person.availability.length === 0 ? (
                    <p className="mt-1 text-sm text-orange-600">No free time added</p>
                  ) : (
                    <ul className="mt-1.5 space-y-0.5 text-sm">
                      {person.availability.map((slot, i) => (
                        <li key={i}>
                          <span className="inline-block w-24 font-medium">{WEEKDAYS[slot.weekday]}</span>
                          {slot.start_time} – {slot.end_time}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Upcoming days off */}
                {upcomingTimeOff.length > 0 && (
                  <div className="mt-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      <CalendarOff className="size-3.5" /> Days off
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-sm">
                      {upcomingTimeOff.map((t) => (
                        <li key={t.id}>
                          {shortDate(t.start_date)}
                          {t.end_date !== t.start_date && ` – ${shortDate(t.end_date)}`}
                          {t.reason && <span className="text-muted-foreground"> · {t.reason}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
