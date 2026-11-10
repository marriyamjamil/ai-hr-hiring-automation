// The backend address, read from .env.local
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const TOKEN_KEY = "hireai_token";

// ---------- Data shapes (match the backend's schemas.py) ----------

export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "hr" | "manager";
  created_at: string;
};

export type Job = {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  experience: string | null;
  required_skills: string[];
  preferred_skills: string[];
  jd_text: string | null;
  rubric: Record<string, number>;
  screening_questions: string[];
  status: string;
  created_at: string;
};

export type CandidateSummary = {
  id: number;
  name: string;
  email: string | null;
  status: string;
  overall_score: number | null;
  summary: string | null;
};

// One rubric criterion's mark, e.g. { score: 34, max: 40, reason: "..." }
export type CriterionScore = {
  score: number;
  max: number;
  reason: string;
};

// Agent 1's full marking of one CV
export type Evaluation = {
  overall_score: number;
  criterion_scores: Record<string, CriterionScore>;
  evidence: string[];
  missing_or_unclear: string[];
  warnings: string[];
  summary: string | null;
  model_version: string | null;
  created_at: string;
};

// One line of HR's decision history (the audit trail)
export type Decision = {
  id: number;
  from_status: string;
  to_status: string;
  reason: string | null;
  decided_by_name: string | null;
  created_at: string;
};

// Everything about one candidate
export type CandidateDetail = {
  id: number;
  job_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  evaluation: Evaluation | null; // null = not scored (needs manual review)
  decisions: Decision[]; // oldest first
};

// The reply after HR approves a shortlist
export type ShortlistResult = {
  job_id: number;
  shortlisted: number;
  skipped: string[];
};

// One row on the "all candidates" page
export type CandidateListItem = {
  id: number;
  name: string;
  email: string | null;
  status: string;
  overall_score: number | null;
  job_id: number;
  job_title: string;
  created_at: string;
};

// ---------- Screening calls (Agent 2) ----------

export type ScreeningMessage = {
  role: "agent" | "candidate";
  text: string;
};

// The AI's marks for one screening question
export type ScreeningAnswer = {
  question: string;
  answer_summary: string;
  score: number; // 0-10
  comment: string;
};

// The report GPT writes after the call
export type ScreeningReport = {
  answers: ScreeningAnswer[];
  strengths: string[];
  concerns: string[];
  summary: string;
  recommendation: "proceed" | "maybe" | "not_recommended";
};

export type ScreeningCall = {
  id: number;
  candidate_id: number;
  job_id: number;
  mode: string; // text / voice
  status: string; // in_progress / completed / cancelled
  consent_given: boolean;
  transcript: ScreeningMessage[];
  question_index: number;
  report: ScreeningReport | null; // null until the call is completed
  overall_score: number | null;
  model_version: string | null;
  started_at: string;
  ended_at: string | null;
};

// What HR fills in for Agent 0 (the AI job description writer)
export type JDGenerateRequest = {
  title: string;
  company_name: string;
  about_company?: string;
  employment_type: "Full-time" | "Part-time" | "Contract" | "Internship" | "Temporary";
  location: string;
  work_arrangement: "On-site" | "Hybrid" | "Remote";
  experience: string;
  required_skills: string[];
  key_responsibilities?: string[];
  department?: string;
  reports_to?: string;
  preferred_skills?: string[];
  education?: string;
  salary_range?: string;
  benefits?: string[];
  application_deadline?: string;
  how_to_apply?: string;
  extra_notes?: string;
  tone?: "Professional" | "Friendly" | "Startup";
};

// The draft Agent 0 sends back (not saved until HR saves it)
export type JDDraft = {
  jd_text: string;
  rubric: Record<string, number>;
  screening_questions: string[];
  title: string; // spelling corrected by the AI
  required_skills: string[];
  preferred_skills: string[];
};

// What we send to save a job
export type JobCreate = {
  title: string;
  department?: string | null;
  location?: string | null;
  experience?: string | null;
  required_skills: string[];
  preferred_skills: string[];
  jd_text: string;
  rubric: Record<string, number>;
  screening_questions: string[];
};

// What happened to each uploaded CV
export type UploadResult = {
  file_name: string;
  status: "scored" | "updated" | "duplicate" | "blocked" | "needs_manual_review" | "rejected" | string;
  candidate_id: number | null;
  overall_score: number | null;
  detail: string | null;
};

export type UploadSummary = {
  job_id: number;
  total_files: number;
  results: UploadResult[];
};

// ---------- The "digital pass" (token), saved in the browser ----------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Turn a backend error into a friendly message
function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "detail" in data && typeof data.detail === "string") {
    return data.detail;
  }
  return fallback;
}

// ---------- One helper for every request: adds the pass automatically ----------

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Can't reach the server. Is the backend running?");
  }

  // Pass missing or expired → back to the login page
  if (response.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(errorMessage(data, `Request failed (${response.status}).`));
  }
  if (response.status === 204) return undefined as T; // "done, nothing to send back"
  return response.json() as Promise<T>;
}

// ---------- Login ----------

export async function login(email: string, password: string): Promise<void> {
  let response: Response;
  try {
    // FastAPI's login expects a "form" with the fields username + password
    response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password }),
    });
  } catch {
    throw new Error("Can't reach the server. Is the backend running?");
  }

  if (response.status === 404) {
    throw new Error("Login isn't set up on the server yet.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(errorMessage(data, "Login failed. Please try again."));
  }

  const data: { access_token: string } = await response.json();
  saveToken(data.access_token);
}

// ---------- Ready-made calls the pages use ----------

// Sends data as JSON
function jsonBody(method: string, data: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}

export const getMe = () => apiFetch<User>("/api/auth/me");

// Jobs
export const getJobs = () => apiFetch<Job[]>("/api/jobs");
export const getJob = (jobId: number) => apiFetch<Job>(`/api/jobs/${jobId}`);
export const generateJD = (details: JDGenerateRequest) =>
  apiFetch<JDDraft>("/api/jobs/generate-jd", jsonBody("POST", details));
export const createJob = (job: JobCreate) => apiFetch<Job>("/api/jobs", jsonBody("POST", job));
export const updateJob = (jobId: number, changes: Partial<JobCreate> & { status?: string }) =>
  apiFetch<Job>(`/api/jobs/${jobId}`, jsonBody("PATCH", changes));
export const approveJob = (jobId: number) => apiFetch<Job>(`/api/jobs/${jobId}/approve`, { method: "POST" });
export const deleteJob = (jobId: number) => apiFetch<void>(`/api/jobs/${jobId}`, { method: "DELETE" });

// Candidates
export const getJobCandidates = (jobId: number) =>
  apiFetch<CandidateSummary[]>(`/api/jobs/${jobId}/candidates`);
export const getCandidate = (candidateId: number) => apiFetch<CandidateDetail>(`/api/candidates/${candidateId}`);
export const getAllCandidates = () => apiFetch<CandidateListItem[]>("/api/candidates");

// HR decisions (the human approval gate)
export const getShortlistSuggestion = (jobId: number, top: number, minScore: number) =>
  apiFetch<CandidateSummary[]>(`/api/jobs/${jobId}/shortlist-suggestion?top=${top}&min_score=${minScore}`);
export const approveShortlist = (jobId: number, candidateIds: number[]) =>
  apiFetch<ShortlistResult>(`/api/jobs/${jobId}/shortlist`, jsonBody("POST", { candidate_ids: candidateIds }));
export const decideCandidate = (
  candidateId: number,
  decision: "shortlisted" | "rejected" | "undo" | "interview_invited",
  reason?: string,
) => apiFetch<CandidateDetail>(`/api/candidates/${candidateId}/decision`, jsonBody("POST", { decision, reason }));

// Upload CVs: files go as "form data" (like a form with file pickers), not JSON
export function uploadResumes(jobId: number, files: File[]) {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  return apiFetch<UploadSummary>(`/api/jobs/${jobId}/resumes`, { method: "POST", body: form });
}

// Screening calls (Agent 2)
export const getScreeningCalls = (candidateId: number) =>
  apiFetch<ScreeningCall[]>(`/api/candidates/${candidateId}/screening-calls`);
export const startScreeningCall = (candidateId: number) =>
  apiFetch<ScreeningCall>(`/api/candidates/${candidateId}/screening-calls`, { method: "POST" });
export const replyToScreeningCall = (callId: number, text: string) =>
  apiFetch<ScreeningCall>(`/api/screening-calls/${callId}/reply`, jsonBody("POST", { text }));
export const cancelScreeningCall = (callId: number) =>
  apiFetch<ScreeningCall>(`/api/screening-calls/${callId}/cancel`, { method: "POST" });
export const retryScreeningReport = (callId: number) =>
  apiFetch<ScreeningCall>(`/api/screening-calls/${callId}/report`, { method: "POST" });
