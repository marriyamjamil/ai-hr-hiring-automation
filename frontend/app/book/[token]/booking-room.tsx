"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Building2, CalendarCheck, CalendarClock, CheckCircle2, Loader2, UserRound, Video, XCircle } from "lucide-react";

import { chooseBooking, confirmBooking, getBooking, type BookingInfo, type BookingSlot } from "@/lib/api";

const PK = "Asia/Karachi"; // all times in Pakistan time

// "2026-11-16T14:00:00+05:00" → "Monday, 16 November"
function dayText(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: PK, weekday: "long", day: "numeric", month: "long" });
}
// → "2:00 pm"
function timeText(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: PK, hour: "numeric", minute: "2-digit", hour12: true });
}

const closedMessages: Record<string, string> = {
  used: "This booking is no longer active. Please contact the HR team.",
  cancelled: "This interview is no longer active. Please contact the HR team.",
  expired: "This link has expired. Please contact the HR team if you need to change your interview time.",
};

const slotKey = (slot: BookingSlot) => `${slot.interviewer_id}|${slot.start}`;

// The candidate's side of Agent 3: see the interview, or choose another free time once
export function BookingRoom() {
  const { token } = useParams<{ token: string }>(); // "/book/abc123" → "abc123"
  const [info, setInfo] = useState<BookingInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [picked, setPicked] = useState(""); // the slotKey of the other time the candidate picked
  const [busy, setBusy] = useState<"confirm" | "choose" | null>(null);
  const [problem, setProblem] = useState("");
  const [changed, setChanged] = useState(false); // true right after the candidate changed the time

  // 1. Check the link when the page opens
  useEffect(() => {
    getBooking(token)
      .then(setInfo)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "This link is not valid."));
  }, [token]);

  // Confirm a held time (only for older interviews that waited for the candidate)
  async function confirm() {
    setBusy("confirm");
    setProblem("");
    try {
      setInfo(await confirmBooking(token));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not confirm. Please try again.");
      getBooking(token).then(setInfo).catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  // Book another time instead
  async function choose() {
    const slot = info?.options.find((s) => slotKey(s) === picked);
    if (!slot) {
      setProblem("Please choose a time first.");
      return;
    }
    if (!window.confirm(`Change your interview to ${dayText(slot.start)}, ${timeText(slot.start)}? You can change it only once.`)) return;
    setBusy("choose");
    setProblem("");
    try {
      setInfo(await chooseBooking(token, { interviewer_id: slot.interviewer_id, start: slot.start }));
      setChanged(true);
    } catch (err) {
      // e.g. "Sorry, that time was just taken": reload the free times
      setProblem(err instanceof Error ? err.message : "Could not book this time. Please try again.");
      setPicked("");
      getBooking(token).then(setInfo).catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  // ---------- What the page shows ----------
  if (loadError) return <Closed message={loadError} />;
  if (!info) return <div className="h-80 w-full max-w-lg animate-pulse rounded-3xl bg-muted" />;

  const canChange = info.status === "pending";

  // ❌ No interview and nothing to choose
  if (!info.held && !(canChange && info.options.length > 0)) {
    return <Closed message={closedMessages[info.status] ?? closedMessages.cancelled} />;
  }

  return (
    <Card>
      <div>
        <p className="text-sm font-medium text-indigo-600">{info.company_name}</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold">
          {info.held && info.confirmed ? `${info.candidate_name}, your interview is scheduled` : `Hi ${info.candidate_name}, let's book your interview`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">For the {info.job_title} role. All times are Pakistan time.</p>
      </div>

      {changed && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" /> Your interview time was changed. We have emailed you the new details.
        </p>
      )}

      {/* ✅ The final interview */}
      {info.held && info.confirmed && (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/5">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">
            <CalendarCheck className="size-4" /> Your interview
          </p>
          <SlotDetails slot={info.held} />
          {info.location && (
            <p className="flex items-start gap-2 text-sm">
              {info.mode === "online" ? <Video className="mt-0.5 size-4 shrink-0 text-indigo-600" /> : <Building2 className="mt-0.5 size-4 shrink-0 text-indigo-600" />}
              <span>
                <span className="font-medium">{info.mode === "online" ? "Online meeting: " : "Address: "}</span>
                {info.mode === "online" ? (
                  <a href={info.location} target="_blank" rel="noreferrer" className="break-all text-indigo-600 underline">
                    {info.location}
                  </a>
                ) : (
                  info.location
                )}
              </span>
            </p>
          )}
        </div>
      )}

      {/* ⏳ An older held time that still waits for the candidate */}
      {info.held && !info.confirmed && (
        <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/5">
          <p className="text-xs font-semibold tracking-wide text-indigo-700 uppercase dark:text-indigo-300">We have reserved this time for you</p>
          <SlotDetails slot={info.held} />
          {canChange && (
            <button
              onClick={confirm}
              disabled={busy !== null}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-60"
            >
              {busy === "confirm" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Confirm this time
            </button>
          )}
        </div>
      )}

      {/* 🔁 Choose another time (once) */}
      {canChange && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{info.held ? "Can't make it? Choose another time (one change allowed):" : "Please choose a time that suits you:"}</p>
          {info.options.length === 0 ? (
            <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
              No other times are free right now. Please contact the HR team if the time above doesn&apos;t suit you.
            </p>
          ) : (
            <>
              {info.options.map((slot) => (
                <label
                  key={slotKey(slot)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${
                    picked === slotKey(slot) ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10" : "hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="time"
                    checked={picked === slotKey(slot)}
                    onChange={() => setPicked(slotKey(slot))}
                    className="accent-indigo-600"
                  />
                  <span className="flex-1">
                    <span className="font-medium">{dayText(slot.start)}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {timeText(slot.start)} – {timeText(slot.end)}
                    </span>
                  </span>
                </label>
              ))}
              <button
                onClick={choose}
                disabled={busy !== null || !picked}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                {busy === "choose" ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
                Change to the time I chose
              </button>
            </>
          )}
        </div>
      )}

      {problem && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{problem}</div>}

      <p className="text-center text-xs text-muted-foreground">
        {canChange
          ? `You can change the time until ${new Date(info.expires_at).toLocaleDateString("en-GB", { timeZone: PK, day: "numeric", month: "long" })}. `
          : ""}
        Please join a few minutes early. Good luck!
      </p>
    </Card>
  );
}

// ---------- Small building blocks ----------

function Card({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-lg space-y-6 rounded-3xl border bg-card p-6 shadow-xl shadow-indigo-500/5 sm:p-8">{children}</div>;
}

function SlotDetails({ slot }: { slot: BookingSlot }) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-2 font-semibold">
        <CalendarClock className="size-4 text-indigo-600" />
        {dayText(slot.start)}, {timeText(slot.start)} – {timeText(slot.end)}
      </p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserRound className="size-4" /> with {slot.interviewer_name}
      </p>
    </div>
  );
}

function Closed({ message }: { message: string }) {
  return (
    <Card>
      <div className="flex flex-col items-center py-6 text-center">
        <XCircle className="size-10 text-muted-foreground" />
        <p className="mt-4 font-display text-lg font-bold">Link not active</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
    </Card>
  );
}
