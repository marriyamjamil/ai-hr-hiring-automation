"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const questions = [
  {
    q: "Does the AI decide who gets hired?",
    a: "No. HireAI suggests and explains; people decide. Job descriptions, shortlists, rejections and interview invites all need a human's approval before anything happens.",
  },
  {
    q: "How does HireAI keep resume scoring fair?",
    a: "Every CV for a job is scored against the same rubric. The AI is told to ignore names, photos, age, gender, nationality and university prestige, and every score comes with evidence quoted from the resume so it can be checked.",
  },
  {
    q: "What happens to candidates' personal data?",
    a: "CVs are stored on your own server, only signed-in team members can see them, and they are never used to train AI models. You can delete a candidate's data whenever they ask.",
  },
  {
    q: "Which file types can I upload?",
    a: "PDF and Word (.docx) resumes, up to 5 MB each. You can upload many at once. Files that can't be read are flagged for manual review instead of being scored.",
  },
  {
    q: "Who can use the workspace?",
    a: "Only people your admin invites. Admins manage accounts, HR runs the hiring workflow, and hiring managers review shortlists. There is no public sign-up.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y rounded-3xl border bg-card">
      {questions.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold transition-colors hover:text-primary"
            >
              {item.q}
              <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <p className="px-6 pb-5 leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
