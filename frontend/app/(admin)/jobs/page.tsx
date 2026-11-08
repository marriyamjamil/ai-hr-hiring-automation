"use client"; // this page runs in the browser (it uses state and clicks)

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Clock, MapPin, Search, Sparkles } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { getJobs, type Job } from "@/lib/api";

// The filter buttons at the top: "value" matches job.status in the database
const filters = [
  { value: "all", label: "All jobs" },
  { value: "draft", label: "Drafts" },
  { value: "approved", label: "Open" },
  { value: "closed", label: "Closed" },
];

// "2026-11-08T10:00:00" → "8 Nov 2026"
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function JobsPage() {
  // ---------- 1. The page's memory (state) ----------
  const [jobs, setJobs] = useState<Job[] | null>(null); // null = still loading
  const [error, setError] = useState(""); // an error message, if loading fails
  const [search, setSearch] = useState(""); // what the user typed in the search box
  const [filter, setFilter] = useState("all"); // which filter button is selected

  // ---------- 2. Load the jobs once, when the page opens ----------
  useEffect(() => {
    getJobs() // asks FastAPI: GET /api/jobs
      .then((list) => setJobs(list)) // success → save the jobs in memory
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load jobs."));
  }, []); // [] = run only once

  // ---------- 3. Apply the search box and the filter buttons ----------
  const visibleJobs = (jobs ?? []).filter((job) => {
    const matchesFilter = filter === "all" || job.status === filter;
    const text = `${job.title} ${job.department ?? ""} ${job.location ?? ""} ${job.required_skills.join(" ")}`;
    const matchesSearch = text.toLowerCase().includes(search.trim().toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // ---------- 4. What the page shows ----------
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header: title + "Create job with AI" button */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Jobs</h1>
          <p className="mt-1 text-muted-foreground">Create roles, approve job descriptions and collect CVs.</p>
        </div>
        <Link
          href="/jobs/new"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.03]"
        >
          <Sparkles className="size-4" /> Create job with AI
        </Link>
      </div>

      {/* Search box + filter buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)} // every key press updates the memory
            placeholder="Search by title, skill or location"
            className="h-11 w-full rounded-xl border bg-background pr-4 pl-10 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-xl border bg-background p-1 no-scrollbar">
          {filters.map((f) => {
            const count = f.value === "all" ? jobs?.length : jobs?.filter((j) => j.status === f.value).length;
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {f.label}
                {jobs && <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20" : "bg-muted"}`}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error message (only if loading failed) */}
      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {/* Loading: grey placeholder boxes while we wait for FastAPI */}
      {!jobs && !error && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-52 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {/* Nothing to show */}
      {jobs && visibleJobs.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
            <Briefcase className="size-6" />
          </span>
          <p className="mt-4 font-display text-lg font-bold">{jobs.length ? "No jobs match your search" : "No jobs yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {jobs.length
              ? "Try a different word or filter."
              : "Describe the role in a few lines and the AI writes the full job description for you."}
          </p>
        </div>
      )}

      {/* One card per job */}
      {visibleJobs.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleJobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="group flex flex-col rounded-2xl border bg-card p-6 shadow-xs transition-all hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/10"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                  <Briefcase className="size-5" />
                </span>
                <StatusBadge status={job.status} />
              </div>

              <h2 className="mt-5 truncate font-display text-lg font-bold group-hover:text-primary">{job.title}</h2>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {job.department && <span>{job.department}</span>}
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" /> {job.location}
                  </span>
                )}
              </div>

              {/* The first 4 skills as chips, then "+2" for the rest */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {job.required_skills.slice(0, 4).map((skill) => (
                  <span key={skill} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {skill}
                  </span>
                ))}
                {job.required_skills.length > 4 && (
                  <span className="px-2 py-1 text-xs text-muted-foreground">+{job.required_skills.length - 4}</span>
                )}
              </div>

              <div className="mt-auto flex items-center gap-1 border-t pt-4 text-xs text-muted-foreground">
                <Clock className="size-3.5" /> Created {formatDate(job.created_at)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}