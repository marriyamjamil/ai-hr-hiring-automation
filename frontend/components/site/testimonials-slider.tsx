"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";

import { portraits } from "@/lib/images";

// Sample quotes to show the design. Replace them with real feedback from your users.
const testimonials = [
  {
    quote:
      "We used to spend Monday mornings just reading CVs. Now the shortlist is waiting for us, with the reasons behind every score.",
    name: "Amara Okafor",
    role: "Head of People",
    company: "Brightpath",
    photo: portraits.amara,
  },
  {
    quote:
      "The job descriptions are genuinely good. We edit a line or two, approve, and the role is live in minutes instead of days.",
    name: "Daniel Reyes",
    role: "Talent Lead",
    company: "Lumen Labs",
    photo: portraits.daniel,
  },
  {
    quote:
      "What sold us was the human approval step. The AI suggests, our team decides, and every decision is recorded.",
    name: "Helen Carter",
    role: "HR Director",
    company: "Cedar Bank",
    photo: portraits.helen,
  },
  {
    quote:
      "Candidates told us the screening call felt respectful and quick. Our time-to-interview dropped from two weeks to three days.",
    name: "James Whitfield",
    role: "Recruitment Manager",
    company: "Orbital",
    photo: portraits.james,
  },
  {
    quote:
      "Scores come with evidence from the resume itself, so I can explain every shortlist decision to a hiring manager.",
    name: "Leila Haddad",
    role: "Senior Recruiter",
    company: "Vertex Health",
    photo: portraits.leila,
  },
];

export function TestimonialsSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = testimonials.length;

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearTimeout(timer);
  }, [index, paused, count]);

  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {testimonials.map((t, i) => (
            <figure key={t.name} aria-hidden={i !== index} className="w-full shrink-0 px-1">
              <div className="relative mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm sm:p-12">
                <Quote className="mx-auto size-10 text-indigo-400" />
                <div className="mt-4 flex justify-center gap-1">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="size-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="mt-6 font-display text-xl leading-relaxed font-medium text-white sm:text-2xl">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-8 flex items-center justify-center gap-4">
                  <Image
                    src={t.photo}
                    alt={t.name}
                    width={56}
                    height={56}
                    className="size-14 rounded-full object-cover ring-2 ring-indigo-400/60"
                  />
                  <div className="text-left">
                    <p className="font-semibold text-white">{t.name}</p>
                    <p className="text-sm text-zinc-400">
                      {t.role}, {t.company}
                    </p>
                  </div>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>

      {/* Arrows and dots */}
      <div className="mt-8 flex items-center justify-center gap-4">
        <button
          onClick={() => go(-1)}
          aria-label="Previous testimonial"
          className="flex size-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex gap-2">
          {testimonials.map((t, i) => (
            <button
              key={t.name}
              onClick={() => setIndex(i)}
              aria-label={`Show testimonial ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? "w-8 bg-indigo-400" : "w-2 bg-white/25 hover:bg-white/40"}`}
            />
          ))}
        </div>
        <button
          onClick={() => go(1)}
          aria-label="Next testimonial"
          className="flex size-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
