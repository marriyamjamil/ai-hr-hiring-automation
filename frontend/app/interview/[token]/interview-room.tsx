"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock, Headphones, Loader2, Mic, PhoneOff, ShieldCheck, XCircle } from "lucide-react";

import { finishInterview, getInterviewInfo, interviewConnected, startInterview, type InterviewInfo } from "@/lib/api";

type VapiClient = import("@vapi-ai/web").default;
type Phase = "loading" | "ready" | "connecting" | "live" | "saving" | "done" | "closed";
type Line = { role: "agent" | "candidate"; text: string };
type VapiMessage = { type?: string; role?: string; transcriptType?: string; transcript?: string };

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? "";

const closedMessages: Record<string, string> = {
  used: "This interview has already been completed. Thank you!",
  cancelled: "This interview link is no longer active.",
  expired: "This interview link has expired. Please contact the HR team.",
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The candidate's side of the screening call: welcome → talk to the AI → saved
export function InterviewRoom() {
  const { token } = useParams<{ token: string }>(); // "/interview/abc123" → "abc123"
  const [info, setInfo] = useState<InterviewInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState(""); // an error, or the final "thank you"
  const [lines, setLines] = useState<Line[]>([]); // live captions
  const [agentTalking, setAgentTalking] = useState(false);
  const [doneTitle, setDoneTitle] = useState("All done"); // "Call ended" if the call didn't count
  const vapiRef = useRef<VapiClient | null>(null); // the one voice connection
  const finishingRef = useRef(false); // stops "finish" from running twice
  const captionsRef = useRef<HTMLDivElement>(null);

  // 1. Check the link when the page opens
  useEffect(() => {
    getInterviewInfo(token)
      .then((data) => {
        setInfo(data);
        if (data.status === "pending") {
          setPhase("ready");
        } else {
          setMessage(closedMessages[data.status] ?? "This interview link is not active.");
          setPhase("closed");
        }
      })
      .catch((err) => {
        setMessage(err instanceof Error ? err.message : "This interview link is not valid.");
        setPhase("closed");
      });
  }, [token]);

  // Hang up if the candidate leaves the page
  useEffect(() => () => void vapiRef.current?.stop(), []);

  // Keep the newest caption in view
  useEffect(() => {
    const box = captionsRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [lines]);

  // 3. After hang-up: ask the backend to fetch the transcript and write the report
  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setAgentTalking(false);
    setPhase("saving");
    // Vapi needs a few seconds to save the call, so we ask up to 8 times (every 3 seconds)
    for (let attempt = 0; attempt < 8; attempt++) {
      await wait(3000);
      try {
        const result = await finishInterview(token);
        if (result.status !== "processing") {
          setDoneTitle(result.status === "cancelled" ? "Call ended" : "All done");
          setMessage(result.message);
          setPhase("done");
          return;
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Something went wrong while saving your interview.");
        setPhase("done");
        return;
      }
    }
    setMessage("Your call ended, but saving is taking longer than usual. Please contact the HR team if you don't hear back.");
    setPhase("done");
  }

  // 2. The candidate presses "Start interview"
  async function start() {
    if (!PUBLIC_KEY) {
      setMessage("Voice interviews are not set up yet (the Vapi public key is missing).");
      return;
    }
    setMessage("");
    setLines([]);
    finishingRef.current = false;
    setPhase("connecting");
    try {
      const { assistant } = await startInterview(token); // our backend: the call record + the agent's script
      const { default: Vapi } = await import("@vapi-ai/web"); // load the voice SDK only in the browser
      const vapi = new Vapi(PUBLIC_KEY);
      vapiRef.current = vapi;

      vapi.on("call-start", () => setPhase("live"));
      vapi.on("speech-start", () => setAgentTalking(true)); // the AI started talking
      vapi.on("speech-end", () => setAgentTalking(false));
      vapi.on("message", (msg: VapiMessage) => {
        // Only finished sentences (not the half-heard guesses while someone is still talking)
        if (msg.type === "transcript" && msg.transcriptType === "final" && msg.transcript) {
          const text = msg.transcript;
          setLines((previous) => [...previous, { role: msg.role === "assistant" ? "agent" : "candidate", text }]);
        }
      });
      vapi.on("call-end", () => void finish());
      vapi.on("error", (error: unknown) => console.error("Vapi error", error));

      const call = await vapi.start(assistant as Parameters<VapiClient["start"]>[0]);
      if (!call?.id) throw new Error("Could not connect the call. Please allow the microphone and try again.");
      await interviewConnected(token, call.id); // tell our backend Vapi's id for this call
    } catch (err) {
      finishingRef.current = true; // don't treat this as a finished call
      vapiRef.current?.stop();
      setMessage(err instanceof Error ? err.message : "Could not start the call.");
      setPhase("ready");
    }
  }

  return (
    <div className="w-full max-w-lg space-y-6 rounded-3xl border bg-card p-8 shadow-sm">
      <p className="text-center font-display text-sm font-bold tracking-wide text-indigo-600">HireAI</p>

      {phase === "loading" && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-8 animate-spin text-indigo-600" />
        </div>
      )}

      {phase === "closed" && (
        <Result icon={<XCircle className="size-10 text-muted-foreground" />} title="Link not active" text={message} />
      )}

      {/* ---------- Welcome screen ---------- */}
      {(phase === "ready" || phase === "connecting") && info && (
        <div className="space-y-5">
          <div className="text-center">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Hi {info.candidate_name} 👋</h1>
            <p className="mt-1 text-muted-foreground">
              Screening interview for <strong className="text-foreground">{info.job_title}</strong>
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            <Tip icon={<Clock className="size-4" />}>
              {info.question_count} short question{info.question_count === 1 ? "" : "s"}, about{" "}
              {Math.max(5, info.question_count * 2)} minutes.
            </Tip>
            <Tip icon={<Headphones className="size-4" />}>Find a quiet place. Headphones help.</Tip>
            <Tip icon={<Mic className="size-4" />}>Your browser will ask to use your microphone. Please allow it.</Tip>
            <Tip icon={<ShieldCheck className="size-4" />}>
              You will talk with an AI assistant. The call is recorded and turned into text, and an HR team member
              reviews it. You can end the call at any time.
            </Tip>
          </ul>
          {message && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}
          <button
            type="button"
            onClick={start}
            disabled={phase === "connecting"}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-70"
          >
            {phase === "connecting" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Connecting…
              </>
            ) : (
              <>
                <Mic className="size-4" /> Start interview
              </>
            )}
          </button>
        </div>
      )}

      {/* ---------- Live call ---------- */}
      {phase === "live" && (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <span
              className={`flex size-24 items-center justify-center rounded-full bg-linear-to-br from-indigo-600 to-violet-600 text-white transition-transform duration-300 ${
                agentTalking ? "scale-110 shadow-xl shadow-indigo-500/40" : ""
              }`}
            >
              <Mic className="size-9" />
            </span>
            <p className="text-sm font-medium">
              {agentTalking ? "The assistant is speaking…" : "Listening… speak when you're ready"}
            </p>
          </div>
          <div ref={captionsRef} className="max-h-56 space-y-2 overflow-y-auto rounded-xl bg-muted/50 p-4 text-sm">
            {lines.length === 0 ? (
              <p className="text-muted-foreground">Live captions appear here.</p>
            ) : (
              lines.map((line, i) => (
                <p key={i}>
                  <span className="font-semibold">{line.role === "agent" ? "Assistant" : "You"}:</span> {line.text}
                </p>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => vapiRef.current?.stop()}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10"
          >
            <PhoneOff className="size-4" /> End call
          </button>
        </div>
      )}

      {phase === "saving" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="size-8 animate-spin text-indigo-600" />
          <p className="font-medium">Saving your interview…</p>
          <p className="text-sm text-muted-foreground">Please don&apos;t close this page.</p>
        </div>
      )}

      {phase === "done" && (
        <Result icon={<CheckCircle2 className="size-10 text-emerald-600" />} title={doneTitle} text={message} />
      )}
    </div>
  );
}

// ---------- Small building blocks ----------

function Tip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-indigo-600">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

function Result({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      {icon}
      <h1 className="font-display text-xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
