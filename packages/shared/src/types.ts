export type JobStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "archived";

export type JobSource =
  | "manual"
  | "chrome-extension"
  | "gmail"
  | "linkedin"
  | "indeed"
  | "greenhouse"
  | "lever"
  | "other";

export type EmailSignal =
  | "recruiter"
  | "interview"
  | "rejection"
  | "offer"
  | "follow-up"
  | "unknown";

export type InterviewStage =
  | "recruiter-screen"
  | "technical"
  | "behavioral"
  | "hiring-manager"
  | "onsite"
  | "final";

export type ResumeVersionStatus = "active" | "draft" | "archived";

export interface SalaryRange {
  min?: number;
  max?: number;
  currency: "USD" | "INR" | "EUR" | "GBP" | "CAD" | "AUD";
}

export interface JobRecord {
  id: string;
  userId: string;
  company: string;
  role: string;
  location: string;
  remotePolicy: "remote" | "hybrid" | "onsite" | "unknown";
  source: JobSource;
  sourceUrl?: string;
  status: JobStatus;
  priority: "low" | "medium" | "high";
  fitScore: number;
  savedAt: string;
  appliedAt?: string;
  nextActionAt?: string;
  salaryRange?: SalaryRange;
  resumeVersionId?: string;
  tags: string[];
  jdText?: string;
  notes?: string;
}

export interface ResumeVersion {
  id: string;
  userId: string;
  label: string;
  targetRoles: string[];
  status: ResumeVersionStatus;
  createdAt: string;
  updatedAt: string;
  fileUrl?: string;
  bulletHighlights: string[];
  keywordCoverage: number;
}

export interface InterviewRound {
  id: string;
  jobId: string;
  stage: InterviewStage;
  scheduledAt?: string;
  interviewer?: string;
  prepQuestions: string[];
  weakTopics: string[];
  memory: string[];
  followUpDraft?: string;
}

export interface ParsedEmail {
  id: string;
  jobId?: string;
  sender: string;
  subject: string;
  receivedAt: string;
  signal: EmailSignal;
  confidence: number;
  nextActionAt?: string;
}

export interface AnalyticsSnapshot {
  applications: number;
  interviews: number;
  offers: number;
  rejections: number;
  recruiterReplies: number;
  responseRate: number;
  interviewRate: number;
}

export interface JobSourcePayload {
  title?: string;
  company?: string;
  location?: string;
  sourceUrl?: string;
  description?: string;
  source?: JobSource;
}

export interface JobImportDraft {
  id: string;
  company: string;
  role: string;
  location: string;
  source: JobSource;
  sourceUrl?: string;
  status: JobStatus;
  priority: JobRecord["priority"];
  tags: string[];
  jdText?: string;
}

export interface JobFitInput {
  jobDescription: string;
  resumeHighlights: string[];
  mustHaveKeywords: string[];
  niceToHaveKeywords?: string[];
}

export interface JobFitScore {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  rationale: string;
}
