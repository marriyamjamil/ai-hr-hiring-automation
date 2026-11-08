"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { TagInput } from "@/components/shared/tag-input";
import { JDReview } from "@/components/jobs/jd-review";
import { generateJD, type JDDraft, type JDGenerateRequest } from "@/lib/api";

// ---------- Styles shared by all boxes (so we don't repeat them) ----------
const inputClass =
  "h-11 w-full rounded-xl border bg-background px-3.5 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10";
const textareaClass =
  "w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10";

// ---------- Choices for the dropdowns (must match the backend's schemas.py) ----------
const employmentTypes = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"] as const;
const workArrangements = ["On-site", "Hybrid", "Remote"] as const;
const tones = ["Professional", "Friendly", "Startup"] as const;

// ---------- Everything the form remembers ----------
type FormState = {
  title: string;
  company_name: string;
  about_company: string;
  department: string;
  reports_to: string;
  employment_type: (typeof employmentTypes)[number];
  work_arrangement: (typeof workArrangements)[number];
  location: string;
  experience: string;
  required_skills: string[];
  preferred_skills: string[];
  responsibilities: string; // typed as text, one responsibility per line
  education: string;
  salary_range: string;
  benefits: string[];
  application_deadline: string;
  how_to_apply: string;
  extra_notes: string;
  tone: (typeof tones)[number];
};

// The form starts empty
const emptyForm: FormState = {
  title: "",
  company_name: "",
  about_company: "",
  department: "",
  reports_to: "",
  employment_type: "Full-time",
  work_arrangement: "On-site",
  location: "",
  experience: "",
  required_skills: [],
  preferred_skills: [],
  responsibilities: "",
  education: "",
  salary_range: "",
  benefits: [],
  application_deadline: "",
  how_to_apply: "",
  extra_notes: "",
  tone: "Professional",
};

export default function NewJobPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // true while the AI is writing
  const [draft, setDraft] = useState<JDDraft | null>(null); // the AI's answer (null = not yet)

  // Change ONE field and keep all the others as they were
  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  // "Line one\nLine two\n\n" → ["Line one", "Line two"]
  function responsibilityList() {
    return form.responsibilities
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  // Check the 7 compulsory fields (same rules as the backend).
  // About the company and responsibilities are optional: the AI handles them.
  // (Employment type and work arrangement are dropdowns, so they always have a value.)
  function checkForm(): string {
    if (form.title.trim().length < 2) return "Enter the job title.";
    if (form.company_name.trim().length < 2) return "Enter the company name.";
    if (form.location.trim().length < 2) return "Enter the location.";
    if (!form.experience.trim()) return "Enter the experience needed, for example 2-4 years.";
    if (form.required_skills.length === 0) return "Add at least one required skill (type it and press Enter).";
    return ""; // empty = no problems
  }

  // Turn the form into exactly what Agent 0 expects (optional fields only if filled)
  function buildRequest(): JDGenerateRequest {
    const optional = (value: string) => value.trim() || undefined;
    return {
      title: form.title.trim(),
      company_name: form.company_name.trim(),
      about_company: optional(form.about_company),
      employment_type: form.employment_type,
      location: form.location.trim(),
      work_arrangement: form.work_arrangement,
      experience: form.experience.trim(),
      required_skills: form.required_skills,
      key_responsibilities: responsibilityList(),
      department: optional(form.department),
      reports_to: optional(form.reports_to),
      preferred_skills: form.preferred_skills,
      education: optional(form.education),
      salary_range: optional(form.salary_range),
      benefits: form.benefits,
      application_deadline: optional(form.application_deadline),
      how_to_apply: optional(form.how_to_apply),
      extra_notes: optional(form.extra_notes),
      tone: form.tone,
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser from reloading the page
    const problem = checkForm();
    setError(problem);
    if (problem) return; // stop here if something is missing

    setLoading(true); // turn the spinner on
    try {
      const result = await generateJD(buildRequest()); // wait for Agent 0 (takes ~10-20 seconds)
      setDraft(result); // put the answer in the box → the page switches to the review screen
      window.scrollTo({ top: 0 }); // start reading from the top
      toast.success("Draft ready! Please review it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI could not write the job description.");
    } finally {
      setLoading(false); // turn the spinner off (whether it worked or failed)
    }
  }

  // The AI has answered → show the review screen instead of the form
  if (draft) {
   
    return (
      <JDReview
        draft={draft}
        basics={{
          department: form.department.trim() || undefined,
          location: `${form.location.trim()} (${form.work_arrangement})`, // e.g. "Lahore (Hybrid)"
          experience: form.experience.trim(),
        }}
        onBack={() => setDraft(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ---------- Header ---------- */}
      <div>
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to jobs
        </Link>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Create a job with AI</h1>
        <p className="mt-1 text-muted-foreground">
          Fields marked * are required. The AI fixes spelling mistakes and writes the full job description, a
          scoring rubric and screening questions.
        </p>

        {/* Where we are in the 3 steps */}
        <ol className="mt-5 flex items-center gap-2 text-sm">
          {["Job details", "AI review", "Save"].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0 ? "bg-linear-to-br from-indigo-600 to-violet-600 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <span className={i === 0 ? "font-semibold" : "text-muted-foreground"}>{label}</span>
              {i < 2 && <span className="mx-1 h-px w-8 bg-border" />}
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* ---------- Section 1: the company and the role ---------- */}
        <Section title="The role" subtitle="Who is hiring, and for what?">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Job title" htmlFor="title" required>
              <input id="title" className={inputClass} placeholder="Python Developer" value={form.title} onChange={(e) => update("title", e.target.value)} />
            </Field>
            <Field label="Company name" htmlFor="company" required>
              <input id="company" className={inputClass} placeholder="ABC Tech" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} />
            </Field>
          </div>
          <Field label="About the company" htmlFor="about" hint="Optional. 2-3 sentences. If empty, the 'About us' section is left out.">
            <textarea id="about" rows={3} className={textareaClass} placeholder="ABC Tech is a Lahore-based software company..." value={form.about_company} onChange={(e) => update("about_company", e.target.value)} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Department" htmlFor="department">
              <input id="department" className={inputClass} placeholder="Engineering" value={form.department} onChange={(e) => update("department", e.target.value)} />
            </Field>
            <Field label="Reports to" htmlFor="reports">
              <input id="reports" className={inputClass} placeholder="Engineering Lead" value={form.reports_to} onChange={(e) => update("reports_to", e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* ---------- Section 2: where and how ---------- */}
        <Section title="Work details" subtitle="Type of contract, place and experience">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Employment type" htmlFor="employment" required>
              <select id="employment" className={inputClass} value={form.employment_type} onChange={(e) => update("employment_type", e.target.value as FormState["employment_type"])}>
                {employmentTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Work arrangement" htmlFor="arrangement" required>
              <select id="arrangement" className={inputClass} value={form.work_arrangement} onChange={(e) => update("work_arrangement", e.target.value as FormState["work_arrangement"])}>
                {workArrangements.map((type) => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Location" htmlFor="location" required>
              <input id="location" className={inputClass} placeholder="Lahore" value={form.location} onChange={(e) => update("location", e.target.value)} />
            </Field>
            <Field label="Experience" htmlFor="experience" required>
              <input id="experience" className={inputClass} placeholder="2-4 years" value={form.experience} onChange={(e) => update("experience", e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* ---------- Section 3: skills and duties ---------- */}
        <Section title="Skills and responsibilities" subtitle="The AI scores CVs against these, so be specific">
          <Field label="Required skills" htmlFor="required" required hint="Type a skill and press Enter.">
            <TagInput id="required" value={form.required_skills} onChange={(tags) => update("required_skills", tags)} placeholder="Python, SQL, REST APIs" />
          </Field>
          <Field label="Preferred skills" htmlFor="preferred" hint="Nice to have, not required.">
            <TagInput id="preferred" value={form.preferred_skills} onChange={(tags) => update("preferred_skills", tags)} placeholder="Docker, AWS" />
          </Field>
          <Field label="Key responsibilities" htmlFor="duties" hint="Optional. One per line. If empty, the AI writes them from the title and skills.">
            <textarea id="duties" rows={4} className={textareaClass} placeholder={"Build REST APIs for our hiring platform\nWrite unit tests and fix bugs"} value={form.responsibilities} onChange={(e) => update("responsibilities", e.target.value)} />
          </Field>
        </Section>

        {/* ---------- Section 4: optional extras ---------- */}
        <Section title="Extras" subtitle="Optional. Leave empty and the AI simply skips that section">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Education" htmlFor="education">
              <input id="education" className={inputClass} placeholder="BS Computer Science or related" value={form.education} onChange={(e) => update("education", e.target.value)} />
            </Field>
            <Field label="Salary range" htmlFor="salary">
              <input id="salary" className={inputClass} placeholder="PKR 150,000 - 250,000 per month" value={form.salary_range} onChange={(e) => update("salary_range", e.target.value)} />
            </Field>
            <Field label="Application deadline" htmlFor="deadline">
              <input id="deadline" type="date" className={inputClass} value={form.application_deadline} onChange={(e) => update("application_deadline", e.target.value)} />
            </Field>
            <Field label="Writing tone" htmlFor="tone">
              <select id="tone" className={inputClass} value={form.tone} onChange={(e) => update("tone", e.target.value as FormState["tone"])}>
                {tones.map((tone) => <option key={tone}>{tone}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Benefits" htmlFor="benefits" hint="Type a benefit and press Enter.">
            <TagInput id="benefits" value={form.benefits} onChange={(tags) => update("benefits", tags)} placeholder="Health insurance, Flexible hours" />
          </Field>
          <Field label="How to apply" htmlFor="apply">
            <input id="apply" className={inputClass} placeholder="Apply through our careers page with your CV" value={form.how_to_apply} onChange={(e) => update("how_to_apply", e.target.value)} />
          </Field>
          <Field label="Extra notes for the AI" htmlFor="notes">
            <textarea id="notes" rows={2} className={textareaClass} placeholder="Small team; mentoring available." value={form.extra_notes} onChange={(e) => update("extra_notes", e.target.value)} />
          </Field>
        </Section>

        {/* ---------- Error + buttons ---------- */}
        {error && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Link href="/jobs" className="inline-flex h-11 items-center rounded-full border px-5 text-sm font-semibold hover:bg-muted">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.03] disabled:cursor-wait disabled:opacity-70 disabled:hover:scale-100"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Writing… (10-20 sec)
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Generate with AI
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- Small building blocks used above ----------

// A white card with a title, holding a group of fields
function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-xs">
      <div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

// A label + the input box + an optional hint underneath
function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}