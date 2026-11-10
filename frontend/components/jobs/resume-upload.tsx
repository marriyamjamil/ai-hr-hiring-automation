"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Copy, FileText, Loader2, RefreshCw, Upload, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { uploadResumes, type UploadResult } from "@/lib/api";

const MAX_MB = 5; // same limit as the backend (config.py → max_upload_mb)
const ALLOWED = [".pdf", ".docx"]; // same types as the backend

export function ResumeUpload({ jobId, onUploaded }: { jobId: number; onUploaded?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null); // a "handle" to the hidden file picker
  const [files, setFiles] = useState<File[]>([]); // files chosen, not uploaded yet
  const [dragging, setDragging] = useState(false); // true while a file is dragged over the box
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]); // the backend's answer per file

  // Check new files and add the good ones to the list
  function addFiles(list: FileList | null) {
    if (!list) return;
    const good: File[] = [];
    for (const file of Array.from(list)) {
      const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase(); // "CV.PDF" → ".pdf"
      if (!ALLOWED.includes(extension)) {
        toast.error(`${file.name}: only PDF and DOCX files are allowed.`);
        continue; // skip this file, check the next one
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`${file.name}: larger than ${MAX_MB} MB.`);
        continue;
      }
      good.push(file);
    }
    // Add them, but skip a file that is already in the list (same name)
    setFiles((previous) => [...previous, ...good.filter((f) => !previous.some((p) => p.name === f.name))]);
  }

  function removeFile(name: string) {
    setFiles((previous) => previous.filter((f) => f.name !== name));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const summary = await uploadResumes(jobId, files); // POST /api/jobs/{id}/resumes
      setResults(summary.results);
      setFiles([]); // empty the "chosen" list
      const count = (s: string) => summary.results.filter((r) => r.status === s).length;
      const parts = [`${count("scored")} new`];
      if (count("updated")) parts.push(`${count("updated")} updated`);
      if (count("duplicate")) parts.push(`${count("duplicate")} duplicate skipped`);
      toast.success(`${summary.total_files} CV${summary.total_files > 1 ? "s" : ""} processed: ${parts.join(", ")}.`);
      onUploaded?.(); // tell the page "new candidates exist" (used in Step 7)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-xs">
      <div>
        <h2 className="font-display text-lg font-bold">Upload CVs</h2>
        <p className="text-sm text-muted-foreground">
          PDF or DOCX, up to {MAX_MB} MB each. Agent 1 scores every CV against this job&apos;s rubric.
        </p>
      </div>

      {/* ---------- The drop box (click it or drag files onto it) ---------- */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()} // open the hidden file picker
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault(); // allow dropping here
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); // stop the browser from opening the file
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10" : "hover:border-indigo-300 hover:bg-muted/50"
        }`}
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
          <Upload className="size-5" />
        </span>
        <p className="mt-3 font-semibold">Drag & drop CVs here</p>
        <p className="text-sm text-muted-foreground">or click to choose files (you can pick many at once)</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = ""; // reset, so the same file can be chosen again
          }}
        />
      </div>

      {/* ---------- Files chosen (not uploaded yet) ---------- */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.name} className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-indigo-600" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
              <button
                type="button"
                onClick={() => removeFile(file.name)}
                disabled={uploading}
                aria-label={`Remove ${file.name}`}
                className="rounded-full p-1 hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:cursor-wait disabled:opacity-70"
            >
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Scoring {files.length} CV{files.length > 1 ? "s" : ""}…
                </>
              ) : (
                <>
                  <Upload className="size-4" /> Upload & score {files.length} CV{files.length > 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ---------- Results from the backend (one row per file) ---------- */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Last upload</p>
          {results.map((result, i) => (
            <div key={`${result.file_name}-${i}`} className="flex items-start gap-3 rounded-xl border px-3 py-2 text-sm">
              <ResultIcon status={result.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{result.file_name}</p>
                {result.detail && <p className="text-xs text-muted-foreground">{result.detail}</p>}
              </div>
              {result.status === "scored" && <span className="font-bold text-indigo-600">{result.overall_score}/100</span>}
              {result.status === "updated" && (
                <span className="shrink-0 text-xs font-medium text-sky-600">
                  Updated{result.overall_score !== null ? ` · ${result.overall_score}/100` : ""}
                </span>
              )}
              {result.status === "duplicate" && <span className="shrink-0 text-xs font-medium text-muted-foreground">Duplicate</span>}
              {result.status === "blocked" && <span className="shrink-0 text-xs font-medium text-destructive">Not accepted</span>}
              {result.status === "needs_manual_review" && (
                <span className="shrink-0 text-xs font-medium text-orange-600">Needs manual review</span>
              )}
              {result.status === "rejected" && <span className="shrink-0 text-xs font-medium text-destructive">Rejected</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// A green tick, orange warning or red cross, depending on the result
function ResultIcon({ status }: { status: string }) {
  if (status === "scored") return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />;
  if (status === "updated") return <RefreshCw className="mt-0.5 size-4 shrink-0 text-sky-600" />;
  if (status === "duplicate") return <Copy className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
  if (status === "blocked") return <Ban className="mt-0.5 size-4 shrink-0 text-destructive" />;
  if (status === "needs_manual_review") return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-500" />;
  return <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />;
}
