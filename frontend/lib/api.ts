// The backend address, read from .env.local (or the GitHub variable when built for Azure).
// Made safe: "https://" is added if it was forgotten, and a "/" at the end is removed.
function cleanApiUrl(value: string | undefined): string {
  const url = (value ?? "").trim().replace(/\/+$/, "");
  if (!url) return "http://127.0.0.1:8000";
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

export const API_URL = cleanApiUrl(process.env.NEXT_PUBLIC_API_URL);

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
  answered?: boolean; // false = the candidate didn't answer this question
  answer_summary: string;
  score: number; // 0-10
  comment: string;
};

// One fact from the HR screening call, e.g. { label: "Notice period", value: "1 month" }
export type ScreeningDetail = {
  key: string;
  label: string;
  value: string | null; // null = not answered
};

// The report GPT writes after the call
export type ScreeningReport = {
  summary: string;
  concerns: string[];
  answered_count?: number; // how many questions were really answered
  // New format: the basic HR facts (notice period, salary, availability...)
  details?: ScreeningDetail[];
  missing?: string[];
  total_questions?: number;
  // Old format (earlier test calls with scored answers)
  answers?: ScreeningAnswer[];
  strengths?: string[];
  recommendation?: string;
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

// A candidate's interview link, as HR sees it
export type ScreeningInvite = {
  id: number;
  token: string;
  status: string; // pending / used / cancelled / expired
  expires_at: string;
  created_at: string;
  used_at: string | null;
};

// ---------- Candidate interview page (public, no login) ----------

export type InterviewInfo = {
  candidate_name: string;
  job_title: string;
  question_count: number;
  status: string; // pending / used / cancelled / expired
  expires_at: string;
};

export type InterviewStart = {
  screening_call_id: number;
  assistant: Record<string, unknown>; // the voice agent's settings, passed to Vapi
};

export type InterviewFinish = {
  status: string; // completed / cancelled / processing
  message: string;
};

// ---------- Interviewers (Agent 3) ----------

// One weekly free block, e.g. { weekday: 0, start_time: "14:00", end_time: "17:00" } = Monday 2-5 pm
export type AvailabilitySlot = {
  weekday: number; // 0 = Monday ... 6 = Sunday
  start_time: string; // "HH:MM", Pakistan time
  end_time: string;
};

// Days an interviewer is away
export type TimeOff = {
  id: number;
  start_date: string; // "2026-11-20"
  end_date: string; // the last day away (included)
  reason: string | null;
};

export type Interviewer = {
  id: number;
  name: string;
  email: string;
  job_title: string | null;
  meeting_link: string | null;
  is_active: boolean;
  created_at: string;
  jobs: { id: number; title: string }[];
  availability: AvailabilitySlot[];
  time_off: TimeOff[];
};

// What we send to add or edit an interviewer (the whole form)
export type InterviewerInput = {
  name: string;
  email: string;
  job_title: string | null;
  meeting_link: string | null;
  is_active: boolean;
  job_ids: number[];
  availability: AvailabilitySlot[];
  time_off: { start_date: string; end_date: string; reason: string | null }[];
};

// ---------- Interview scheduling (Agent 3) ----------

// One time window the candidate is free (Pakistan time)
export type TimeWindow = { day: string; start: string; end: string }; // "2026-11-16", "14:00", "18:00"

// What Agent 3 understood from the screening call
export type CandidateAvailability = {
  source_text: string | null; // what the candidate said
  call_date: string;
  windows: TimeWindow[]; // first choice first
  flexible: boolean;
  note: string;
};

// One free interview slot (ISO times with +05:00)
export type Slot = {
  interviewer_id: number;
  interviewer_name: string;
  start: string;
  end: string;
};

export type SlotSuggestions = {
  status: "matched" | "flexible" | "no_match" | "no_times" | "no_free_time" | "no_interviewers" | string;
  reason: string;
  availability: CandidateAvailability;
  best: Slot | null;
  backups: Slot[];
};

export type Interview = {
  id: number;
  candidate_id: number;
  job_id: number;
  interviewer_id: number;
  interviewer_name: string;
  start_at: string;
  end_at: string;
  mode: "online" | "onsite" | string;
  location: string | null;
  status: "awaiting_candidate" | "scheduled" | "cancelled" | "completed" | string;
  candidate_windows: TimeWindow[];
  ai_reason: string | null;
  approved_at: string | null;
  created_at: string;
};

// One email in the Outbox
export type OutboxEmail = {
  id: number;
  to_email: string;
  to_name: string | null;
  subject: string;
  body: string;
  ics: string | null; // the calendar file, if any
  candidate_id: number | null;
  interview_id: number | null;
  status: "queued" | "sent" | "failed" | "held" | string;
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

// The candidate's booking link, as HR sees it
export type BookingLink = {
  token: string;
  status: string; // pending / used / cancelled / expired
  expires_at: string;
  used_at: string | null;
};

// One interview time on the candidate's booking page
export type BookingSlot = { interviewer_id: number; interviewer_name: string; start: string; end: string };

// What the candidate's booking page shows (public)
export type BookingInfo = {
  candidate_name: string;
  job_title: string;
  company_name: string;
  status: string; // pending / used / cancelled / expired
  held: BookingSlot | null; // the candidate's interview time (null = cancelled)
  confirmed: boolean; // true = the time is final (HR approved it)
  mode: string | null; // online / onsite
  location: string | null; // only once confirmed
  options: BookingSlot[]; // other free times
  expires_at: string;
};

export type InterviewApproval = {
  interviewer_id: number;
  start: string;
  mode: "online" | "onsite";
  location?: string | null;
  reason?: string | null;
  candidate_windows?: TimeWindow[];
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
  if (data && typeof data === "object" && "detail" in data) {
    const detail = data.detail;
    if (typeof detail === "string") return detail;
    // 422 = the form had a mistake: FastAPI sends a list of problems, we show the first one
    if (Array.isArray(detail) && typeof detail[0]?.msg === "string") {
      return detail[0].msg.replace(/^Value error, /, "");
    }
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
export const retryScreeningReport = (callId: number) =>
  apiFetch<ScreeningCall>(`/api/screening-calls/${callId}/report`, { method: "POST" });
export const getInvite = (candidateId: number) =>
  apiFetch<ScreeningInvite | null>(`/api/candidates/${candidateId}/invite`);
export const createInvite = (candidateId: number) =>
  apiFetch<ScreeningInvite>(`/api/candidates/${candidateId}/invite`, { method: "POST" });

// Interviewers (Agent 3)
export const getInterviewers = () => apiFetch<Interviewer[]>("/api/interviewers");
export const createInterviewer = (data: InterviewerInput) =>
  apiFetch<Interviewer>("/api/interviewers", jsonBody("POST", data));
export const updateInterviewer = (interviewerId: number, data: InterviewerInput) =>
  apiFetch<Interviewer>(`/api/interviewers/${interviewerId}`, jsonBody("PUT", data));
export const deleteInterviewer = (interviewerId: number) =>
  apiFetch<void>(`/api/interviewers/${interviewerId}`, { method: "DELETE" });

// Interview scheduling (Agent 3)
export const getSlotSuggestions = (candidateId: number) =>
  apiFetch<SlotSuggestions>(`/api/candidates/${candidateId}/slot-suggestions`);
export const getInterviews = (candidateId: number) =>
  apiFetch<Interview[]>(`/api/candidates/${candidateId}/interviews`);
export const approveInterview = (candidateId: number, data: InterviewApproval) =>
  apiFetch<Interview>(`/api/candidates/${candidateId}/interviews`, jsonBody("POST", data));
export const cancelInterview = (interviewId: number) =>
  apiFetch<Interview>(`/api/interviews/${interviewId}/cancel`, { method: "POST" });
export const getEmails = (candidateId?: number) =>
  apiFetch<OutboxEmail[]>(candidateId ? `/api/emails?candidate_id=${candidateId}` : "/api/emails");
export const sendEmailNow = (emailId: number) =>
  apiFetch<OutboxEmail>(`/api/emails/${emailId}/send`, { method: "POST" });
export const getBookingLink = (candidateId: number) =>
  apiFetch<BookingLink | null>(`/api/candidates/${candidateId}/booking-link`);

// Candidate booking page (public: the token in the link is the permission)
const bookingPath = (token: string) => `/api/booking/${encodeURIComponent(token)}`;
export const getBooking = (token: string) => apiFetch<BookingInfo>(bookingPath(token));
export const confirmBooking = (token: string) =>
  apiFetch<BookingInfo>(`${bookingPath(token)}/confirm`, { method: "POST" });
export const chooseBooking = (token: string, slot: { interviewer_id: number; start: string }) =>
  apiFetch<BookingInfo>(`${bookingPath(token)}/choose`, jsonBody("POST", slot));

// Candidate interview (public: the token in the link is the permission)
const interviewPath = (token: string) => `/api/interview/${encodeURIComponent(token)}`;
export const getInterviewInfo = (token: string) => apiFetch<InterviewInfo>(interviewPath(token));
export const startInterview = (token: string) =>
  apiFetch<InterviewStart>(`${interviewPath(token)}/start`, { method: "POST" });
export const interviewConnected = (token: string, vapiCallId: string) =>
  apiFetch<void>(`${interviewPath(token)}/connected`, jsonBody("POST", { vapi_call_id: vapiCallId }));
export const finishInterview = (token: string) =>
  apiFetch<InterviewFinish>(`${interviewPath(token)}/finish`, { method: "POST" });
