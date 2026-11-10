"use client";

import { useEffect, useState } from "react";
import { Info, Inbox } from "lucide-react";

import { EmailList } from "@/components/shared/email-list";
import { getEmails, type OutboxEmail } from "@/lib/api";

const filters = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "held", label: "Not sent" },
];

export default function OutboxPage() {
  const [emails, setEmails] = useState<OutboxEmail[] | null>(null); // null = loading
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getEmails()
      .then(setEmails)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load emails."));
  }, []);

  // While some emails are still queued, check again every 10 seconds (Gmail sends them in the background)
  const hasQueued = (emails ?? []).some((e) => e.status === "queued");
  useEffect(() => {
    if (!hasQueued) return;
    const timer = setInterval(() => {
      getEmails().then(setEmails).catch(() => {});
    }, 10_000);
    return () => clearInterval(timer);
  }, [hasQueued]);

  // After "Send now" / "Retry": put the updated email in the list
  const replaceEmail = (updated: OutboxEmail) =>
    setEmails((list) => (list ? list.map((e) => (e.id === updated.id ? updated : e)) : list));

  const visible = (emails ?? []).filter((e) => filter === "all" || e.status === filter);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Outbox</h1>
        <p className="mt-1 text-muted-foreground">Every email the system wrote to candidates and interviewers.</p>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        New emails are sent by Gmail automatically within a few seconds. &ldquo;Failed&rdquo; emails show the reason and can be
        retried. &ldquo;Not sent&rdquo; emails are old test emails written before Gmail was switched on.
      </p>

      <div className="flex w-fit gap-1 rounded-xl border bg-background p-1">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value ? "bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
            {emails && ` (${f.value === "all" ? emails.length : emails.filter((e) => e.status === f.value).length})`}
          </button>
        ))}
      </div>

      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {!emails && !error && <div className="h-64 animate-pulse rounded-2xl bg-muted" />}

      {emails && visible.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <Inbox className="size-8 text-muted-foreground" />
          <p className="mt-3 font-display text-lg font-bold">No emails yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Emails appear here when HR approves an interview time.</p>
        </div>
      )}

      {visible.length > 0 && <EmailList emails={visible} onChange={replaceEmail} />}
    </div>
  );
}
