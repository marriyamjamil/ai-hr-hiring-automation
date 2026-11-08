"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Search, Users } from "lucide-react";

import { ScoreRing } from "@/components/shared/score-ring";
import { StatusBadge } from "@/components/shared/status-badge";
import { getAllCandidates, type CandidateListItem } from "@/lib/api";

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "scored", label: "Scored" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "rejected", label: "Rejected" },
  { value: "needs_manual_review", label: "Needs review" },
];

const sortOptions = [
  { value: "score", label: "Highest score" },
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name A–Z" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const selectClass =
  "h-11 rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10";

export default function CandidatesPage() {
  const router = useRouter();

  // ---------- 1. The page's memory ----------
  const [candidates, setCandidates] = useState<CandidateListItem[] | null>(null); // null = loading
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("all"); // "all" or a job id like "5"
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("score");

  // ---------- 2. Load everyone once ----------
  useEffect(() => {
    getAllCandidates() // GET /api/candidates
      .then(setCandidates)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load candidates."));
  }, []);

  // ---------- 3. The job dropdown: one option per job that has candidates ----------
  const jobs = new Map<number, string>(); // job id → job title (a Map keeps each job only once)
  (candidates ?? []).forEach((c) => jobs.set(c.job_id, c.job_title));

  // ---------- 4. Search + filter + sort (all in the browser, instant) ----------
  const text = search.trim().toLowerCase();
  const visible = (candidates ?? [])
    .filter((c) => jobFilter === "all" || c.job_id === Number(jobFilter))
    .filter((c) => statusFilter === "all" || c.status === statusFilter)
    .filter((c) => `${c.name} ${c.email ?? ""}`.toLowerCase().includes(text))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "newest") return b.created_at.localeCompare(a.created_at);
      return (b.overall_score ?? -1) - (a.overall_score ?? -1); // highest score first, unscored last
    });

  // ---------- 5. What the page shows ----------
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Candidates</h1>
        <p className="mt-1 text-muted-foreground">Everyone who applied, across all jobs.</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="h-11 w-full rounded-xl border bg-background pr-4 pl-10 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select aria-label="Filter by job" className={selectClass} value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
            <option value="all">All jobs</option>
            {[...jobs].map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
          <select aria-label="Filter by status" className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select aria-label="Sort" className={selectClass} value={sort} onChange={(e) => setSort(e.target.value)}>
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {/* Loading */}
      {!candidates && !error && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {/* Empty */}
      {candidates && visible.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="mt-3 font-display text-lg font-bold">{candidates.length ? "No candidates match" : "No candidates yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {candidates.length ? "Try a different search or filter." : "Open an approved job and upload CVs."}
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            Showing {visible.length} of {candidates?.length}
          </p>

          {/* ---------- Big screens: a table ---------- */}
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-xs md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Candidate</th>
                  <th className="px-5 py-3 font-medium">Job</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Received</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/candidates/${c.id}`)} // the whole row opens the candidate
                    className="cursor-pointer border-b last:border-0 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5"
                  >
                    <td className="px-5 py-3">
                      <Link href={`/candidates/${c.id}`} className="font-semibold hover:text-primary" onClick={(e) => e.stopPropagation()}>
                        {c.name}
                      </Link>
                      {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{c.job_title}</td>
                    <td className="px-5 py-3">
                      {c.overall_score !== null ? (
                        <ScoreRing score={c.overall_score} size={40} stroke={4} />
                      ) : (
                        <AlertTriangle className="size-5 text-orange-500" aria-label="Not scored" />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---------- Phones: cards ---------- */}
          <div className="space-y-2 md:hidden">
            {visible.map((c) => (
              <Link key={c.id} href={`/candidates/${c.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                {c.overall_score !== null ? (
                  <ScoreRing score={c.overall_score} size={44} stroke={4} />
                ) : (
                  <AlertTriangle className="size-5 text-orange-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.job_title}</p>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
