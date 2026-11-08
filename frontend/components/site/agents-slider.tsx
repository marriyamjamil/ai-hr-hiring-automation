"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CalendarCheck, Check, FileSearch, Mic, PhoneCall, Sparkles } from "lucide-react";

import { ScoreRing } from "@/components/shared/score-ring";
import { photos } from "@/lib/images";

const SLIDE_MS = 7000; // each slide stays 7 seconds

// ---------- The small "app screens" shown on each slide ----------

function JdMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-indigo-600">
        <Sparkles className="size-3.5" /> Generated in 11 seconds
      </div>
      <p className="font-display text-lg font-bold">Python Developer</p>
      <p className="text-xs text-muted-foreground">ABC Tech · Lahore (Hybrid) · Full-time</p>
      <div className="space-y-2 pt-1">
        {["w-full", "w-11/12", "w-4/5"].map((w) => (
          <div key={w} className={`h-2 rounded-full bg-muted ${w}`} />
        ))}
      </div>
      <p className="pt-1 text-xs font-semibold">Key responsibilities</p>
      {["Build and maintain REST APIs", "Design efficient SQL schemas", "Write tests and review code"].map((t) => (
        <p key={t} className="flex items-center gap-2 text-xs">
          <Check className="size-3.5 text-emerald-500" /> {t}
        </p>
      ))}
      <div className="flex gap-2 pt-2">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">Rubric ready</span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">7 questions</span>
      </div>
    </div>
  );
}

function ScoreMock() {
  const criteria = [
    { name: "Required skills", score: 36, max: 40 },
    { name: "Experience", score: 21, max: 25 },
    { name: "Projects", score: 17, max: 20 },
    { name: "Education", score: 8, max: 10 },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={87} size={76} />
        <div>
          <p className="font-display font-bold">Ayesha R.</p>
          <p className="text-xs text-muted-foreground">Strong match · ranked #1 of 42</p>
        </div>
      </div>
      {criteria.map((c) => (
        <div key={c.name}>
          <div className="mb-1 flex justify-between text-xs">
            <span>{c.name}</span>
            <span className="font-medium">
              {c.score}/{c.max}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-linear-to-r from-indigo-500 to-violet-500" style={{ width: `${(c.score / c.max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CallMock() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium">Screening call · 03:42</span>
        </div>
        <Mic className="size-4 text-muted-foreground" />
      </div>
      <div className="flex h-12 items-center justify-center gap-1">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="h-full w-1 origin-center animate-wave rounded-full bg-linear-to-t from-indigo-500 to-fuchsia-400"
            style={{ animationDelay: `${(i % 7) * 0.12}s` }}
          />
        ))}
      </div>
      <div className="space-y-2 text-xs">
        <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
          Tell me about an API you built and how you tested it.
        </p>
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-3 py-2 text-white">
          I built a booking API in FastAPI with pytest coverage around 90%...
        </p>
      </div>
    </div>
  );
}

function CalendarMock() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className="space-y-4">
      <p className="font-display font-bold">November 2026</p>
      <div className="grid grid-cols-5 gap-2 text-center text-xs">
        {days.map((d, i) => (
          <div key={d} className="space-y-2">
            <p className="text-muted-foreground">{d}</p>
            <p
              className={`rounded-lg py-2 font-medium ${
                i === 3 ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" : "bg-muted"
              }`}
            >
              {16 + i}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-background p-3">
        <p className="text-xs font-semibold">Technical interview</p>
        <p className="text-xs text-muted-foreground">Thu 19 Nov · 3:00 PM · Google Meet</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
          <Check className="size-3.5" /> Invites sent to candidate and panel
        </p>
      </div>
    </div>
  );
}

// ---------- The slides ----------

const slides = [
  {
    tab: "JD Generator",
    icon: Sparkles,
    title: "From a few notes to a polished job post",
    text: "Type the essentials and the AI writes a clear, inclusive job description, a scoring rubric and screening questions. You review and approve.",
    points: ["Inclusive, bias-checked wording", "Rubric that always adds up to 100", "Edit anything before it goes live"],
    image: photos.presentation,
    mock: <JdMock />,
  },
  {
    tab: "Resume Scorer",
    icon: FileSearch,
    title: "Every CV scored the same fair way",
    text: "Drop in a pile of PDFs. Each resume is scored against the same rubric, with the evidence behind every mark, so you can see exactly why.",
    points: ["Scores with quoted evidence", "Ignores names, photos and age", "Flags anything unclear for review"],
    image: photos.devsAtDesk,
    mock: <ScoreMock />,
  },
  {
    tab: "Screening Calls",
    icon: PhoneCall,
    title: "First-round calls without the calendar chaos",
    text: "A friendly AI voice agent asks your approved screening questions, at a time that suits the candidate, and gives you a transcript and summary.",
    points: ["Uses only your approved questions", "Full transcript for every call", "Candidates can always ask for a human"],
    image: photos.interview,
    mock: <CallMock />,
  },
  {
    tab: "Interview Scheduler",
    icon: CalendarCheck,
    title: "Interviews booked in one click",
    text: "Shortlisted candidates pick a slot that fits the panel's calendars. Invites, reminders and reschedules are handled for you.",
    points: ["Finds slots that suit everyone", "Automatic reminders", "Works with Google and Outlook"],
    image: photos.boardroom,
    mock: <CalendarMock />,
  },
];

export function AgentsSlider() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Move to the next slide automatically (paused while the mouse is over it)
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => setActive((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [active, paused]);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Tabs with a progress bar */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
        {slides.map((slide, i) => (
          <button
            key={slide.tab}
            onClick={() => setActive(i)}
            className={`relative shrink-0 overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all ${
              i === active ? "border-indigo-200 bg-white shadow-md dark:border-indigo-500/30 dark:bg-card" : "bg-transparent hover:bg-white/60 dark:hover:bg-card/60"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <slide.icon className={`size-4 ${i === active ? "text-indigo-600" : "text-muted-foreground"}`} />
              {slide.tab}
            </span>
            {i === active && (
              <span
                key={`${active}-${paused}`}
                className="absolute bottom-0 left-0 h-0.5 animate-progress bg-linear-to-r from-indigo-500 to-fuchsia-500"
                style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* The sliding track */}
      <div className="mt-6 overflow-hidden rounded-3xl">
        <div
          className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div key={slide.tab} aria-hidden={i !== active} className="w-full shrink-0">
              <div className="grid items-center gap-8 rounded-3xl border bg-white p-6 sm:p-10 lg:grid-cols-2 dark:bg-card">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <slide.icon className="size-3.5" /> Agent {i}
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">{slide.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{slide.text}</p>
                  <ul className="mt-6 space-y-3">
                    {slide.points.map((point) => (
                      <li key={point} className="flex items-center gap-3 text-sm font-medium">
                        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
                          <Check className="size-3.5" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Photo with the "app screen" floating on top */}
                <div className="relative h-80 overflow-hidden rounded-2xl sm:h-96">
                  <Image src={slide.image} alt="" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
                  <div className="absolute inset-0 bg-linear-to-t from-indigo-950/70 via-indigo-950/20 to-transparent" />
                  <div className="absolute right-4 bottom-4 left-4 rounded-2xl border border-white/40 bg-white/90 p-5 shadow-2xl backdrop-blur-md sm:right-auto sm:w-80 dark:bg-zinc-900/90">
                    {slide.mock}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
