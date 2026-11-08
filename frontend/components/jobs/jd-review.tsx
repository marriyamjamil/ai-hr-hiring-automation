"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";

import { MarkdownView } from "@/components/shared/markdown-view";
import { TagInput } from "@/components/shared/tag-input";
import { approveJob, createJob, type JDDraft } from "@/lib/api";

// Facts from the form that the job needs when it is saved
export type JobBasics = {
  department?: string;
  location: string;
  experience: string;
};

// Nice names for the 5 rubric criteria
const rubricLabels: Record<string, string> = {
  required_skills: "Required skills",
  relevant_experience: "Relevant experience",
  projects: "Projects",
  education_certifications: "Education & certifications",
  other_job_related: "Other job-related",
};

const inputClass =
  "h-11 w-full rounded-xl border bg-background px-3.5 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10";
const textareaClass =
  "w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10";

export function JDReview({ draft, basics, onBack }: { draft: JDDraft; basics: JobBasics; onBack: () => void }) {
  const router = useRouter();

  // HR's editable copy of the AI draft (starts with the AI's values)
  const [title, setTitle] = useState(draft.title);
  const [requiredSkills, setRequiredSkills] = useState(draft.required_skills);
  const [preferredSkills, setPreferredSkills] = useState(draft.preferred_skills);
  const [jdText, setJdText] = useState(draft.jd_text);
  const [editingJD, setEditingJD] = useState(false); // false = preview, true = edit box
  const [rubric, setRubric] = useState(draft.rubric);
  const [questions, setQuestions] = useState(draft.screening_questions.join("\n")); // one per line
  const [saving, setSaving] = useState<"draft" | "approve" | null>(null); // which button is busy

  // Add up all rubric weights, e.g. 40 + 25 + 20 + 10 + 5 = 100
  const rubricTotal = Object.values(rubric).reduce((sum, weight) => sum + weight, 0);

  // Change ONE rubric number (kept between 0 and 100, whole numbers only)
  function changeWeight(name: string, value: string) {
    const number = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    setRubric((previous) => ({ ...previous, [name]: number }));
  }

  async function save(approve: boolean) {
    // Same checks as the backend, so HR gets a clear message straight away
    if (title.trim().length < 2) return toast.error("Enter a job title.");
    if (requiredSkills.length === 0) return toast.error("Add at least one required skill.");
    if (approve && jdText.trim().length < 100) return toast.error("The job description is too short to approve.");
    if (approve && rubricTotal !== 100) return toast.error(`The rubric must add up to 100 (now ${rubricTotal}).`);

    setSaving(approve ? "approve" : "draft");
    try {
      // 1) Save the job (status = draft)
      const job = await createJob({
        title: title.trim(),
        department: basics.department ?? null,
        location: basics.location,
        experience: basics.experience,
        required_skills: requiredSkills,
        preferred_skills: preferredSkills,
        jd_text: jdText,
        rubric,
        screening_questions: questions.split("\n").map((q) => q.trim()).filter(Boolean),
      });

      // 2) Approve it (only for the "Save & approve" button)
      if (approve) {
        try {
          await approveJob(job.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Approval failed.";
          toast.error(`Saved as a draft, but not approved: ${message}`);
          router.push("/jobs");
          return;
        }
      }

      toast.success(approve ? "Job saved and approved!" : "Job saved as a draft.");
      router.push("/jobs"); // back to the jobs list
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the job.");
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ---------- Header ---------- */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to the form
        </button>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Review the AI draft</h1>
        <p className="mt-1 text-muted-foreground">
          Check and edit everything. Nothing is saved until you click a button at the bottom.
        </p>
      </div>

      {/* ---------- 1. Title and skills ---------- */}
      <Card title="Title and skills" subtitle="Spelling corrected by the AI. Change anything you like.">
        <div className="space-y-1.5">
          <label htmlFor="title" className="text-sm font-medium">Job title</label>
          <input id="title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="required" className="text-sm font-medium">Required skills</label>
          <TagInput id="required" value={requiredSkills} onChange={setRequiredSkills} placeholder="Add a skill" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="preferred" className="text-sm font-medium">Preferred skills</label>
          <TagInput id="preferred" value={preferredSkills} onChange={setPreferredSkills} placeholder="Add a skill" />
        </div>
      </Card>

      {/* ---------- 2. The job description (preview or edit) ---------- */}
      <Card
        title="Job description"
        subtitle="This is what candidates will read"
        action={
          <button
            type="button"
            onClick={() => setEditingJD(!editingJD)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            {editingJD ? <><Eye className="size-3.5" /> Preview</> : <><Pencil className="size-3.5" /> Edit</>}
          </button>
        }
      >
        {editingJD ? (
          <textarea
            rows={22}
            className={`${textareaClass} font-mono text-xs`}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
        ) : (
          <MarkdownView text={jdText} />
        )}
      </Card>

      {/* ---------- 3. The scoring rubric ---------- */}
      <Card title="Scoring rubric" subtitle="How CVs will be scored. The numbers must add up to 100.">
        <div className="space-y-4">
          {Object.entries(rubric).map(([name, weight]) => (
            <div key={name}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <label htmlFor={`rubric-${name}`}>{rubricLabels[name] ?? name}</label>
                <input
                  id={`rubric-${name}`}
                  type="number"
                  min={0}
                  max={100}
                  className="h-9 w-20 rounded-lg border bg-background px-2 text-right text-sm"
                  value={weight}
                  onChange={(e) => changeWeight(name, e.target.value)}
                />
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 transition-all"
                  style={{ width: `${weight}%` }}
                />
              </div>
            </div>
          ))}
          <p className={`text-right text-sm font-semibold ${rubricTotal === 100 ? "text-emerald-600" : "text-destructive"}`}>
            Total: {rubricTotal} / 100 {rubricTotal === 100 ? "✓" : "(must be 100)"}
          </p>
        </div>
      </Card>

      {/* ---------- 4. Screening questions ---------- */}
      <Card title="Screening questions" subtitle="One question per line. Asked later during the screening call.">
        <textarea rows={8} className={textareaClass} value={questions} onChange={(e) => setQuestions(e.target.value)} />
      </Card>

      {/* ---------- Buttons ---------- */}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving !== null}
          className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold hover:bg-muted disabled:opacity-60"
        >
          {saving === "draft" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save as draft
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving !== null}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-60"
        >
          {saving === "approve" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Save & approve
        </button>
      </div>
    </div>
  );
}

// ---------- A white card with a title (and an optional button on the right) ----------
function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}