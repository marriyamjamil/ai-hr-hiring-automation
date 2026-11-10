"use client";

import { useState } from "react";
import { CalendarPlus, ChevronDown, Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { sendEmailNow, type OutboxEmail } from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  sent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  held: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  sent: "Sent ✓",
  failed: "Failed",
  held: "Not sent",
};

function formatWhen(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

// Save the calendar file, so HR can open it and check it adds the interview correctly
function downloadIcs(email: OutboxEmail) {
  if (!email.ics) return;
  const url = URL.createObjectURL(new Blob([email.ics], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `interview-${email.interview_id ?? email.id}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

// A list of emails; click one to read it (used on the Outbox page and the candidate page)
export function EmailList({
  emails,
  onChange,
}: {
  emails: OutboxEmail[];
  onChange?: (email: OutboxEmail) => void; // called after "Send now" with the updated email
}) {
  const [open, setOpen] = useState<number | null>(null); // the email being read
  const [sendingId, setSendingId] = useState<number | null>(null);

  async function send(email: OutboxEmail) {
    setSendingId(email.id);
    try {
      const updated = await sendEmailNow(email.id);
      onChange?.(updated);
      if (updated.status === "sent") toast.success(`Email sent to ${updated.to_email}`);
      else toast.error(updated.error ?? "Gmail could not send this email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the email.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {emails.map((email) => {
        const isOpen = open === email.id;
        const canSend = email.status === "failed" || email.status === "held";
        return (
          <li key={email.id}>
            <button
              onClick={() => setOpen(isOpen ? null : email.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
            >
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{email.subject}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  To: {email.to_name ? `${email.to_name} <${email.to_email}>` : email.to_email}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[email.status] ?? ""}`}>
                {STATUS_LABEL[email.status] ?? email.status}
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {formatWhen(email.sent_at ?? email.created_at)}
              </span>
              <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <div className="space-y-3 border-t bg-muted/20 px-4 py-4">
                {email.error && (
                  <p className={`text-sm ${email.status === "held" ? "text-muted-foreground" : "text-red-600"}`}>⚠ {email.error}</p>
                )}
                {email.status === "sent" && email.sent_at && (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">✓ Sent by Gmail on {formatWhen(email.sent_at)}</p>
                )}
                <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{email.body}</pre>
                <div className="flex flex-wrap gap-2">
                  {email.ics && (
                    <button
                      onClick={() => downloadIcs(email)}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    >
                      <CalendarPlus className="size-4" /> Calendar invite (.ics)
                    </button>
                  )}
                  {canSend && (
                    <button
                      onClick={() => send(email)}
                      disabled={sendingId === email.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:opacity-90 disabled:opacity-60"
                    >
                      {sendingId === email.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      {email.status === "failed" ? "Retry" : "Send now"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
