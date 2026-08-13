// Mirrors CareerJob (packages/shared/src/types.ts JobRecord + apps/web/src/lib/firebase/jobs.ts extensions).
export type JobSource =
  | "manual"
  | "chrome-extension"
  | "gmail"
  | "linkedin"
  | "indeed"
  | "greenhouse"
  | "lever"
  | "other";

export type JobStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "archived";
export type JobPriority = "low" | "medium" | "high";
export type RemotePolicy = "remote" | "hybrid" | "onsite" | "unknown";

export type JobSkillCategory = {
  category: string;
  items: string[];
};

export type CareerJob = {
  id: string;
  userId: string;
  company: string;
  companyLogoUrl?: string;
  role: string;
  location: string;
  locationOptions?: string[];
  remotePolicy: RemotePolicy;
  source: JobSource;
  sourceUrl?: string;
  status: JobStatus;
  priority: JobPriority;
  fitScore: number;
  savedAt: string;
  appliedAt?: string;
  nextActionAt?: string;
  jdSkillCategories?: JobSkillCategory[];
  resumeSource?: "resume" | "visual";
  resumeVersionId?: string;
  submittedResumeContentType?: string;
  submittedResumeFileName?: string;
  submittedResumeR2Key?: string;
  submittedResumeUploadedAt?: string;
  submittedResumeUrl?: string;
  tags: string[];
  jdText?: string;
  notes?: string;
  createdAt?: string;
  postedAtText?: string;
  workplaceTypeText?: string;
  jobTypeText?: string;
  employmentType?: string;
  experienceText?: string;
  salaryText?: string;
  aboutText?: string;
  responsibilitiesText?: string;
  eligibilityText?: string;
  skills?: string[];
  interviewReminderId?: string;
  updatedAt?: string;
};

// Same state machine as apps/web/src/app/applications/page.tsx's `statusTransitions` - the only allowed forward
// (or lateral) moves from a given stage. Enforced identically here so "change status" always offers valid choices.
export const statusTransitions: Record<JobStatus, JobStatus[]> = {
  saved: ["saved", "applied"],
  applied: ["saved", "applied", "interviewing", "rejected"],
  interviewing: ["applied", "interviewing", "offer", "rejected"],
  offer: ["interviewing", "offer"],
  rejected: ["rejected"],
  archived: ["rejected"]
};

export function normalizeEditableStatus(status: JobStatus): JobStatus {
  return status === "archived" ? "rejected" : status;
}

export function sourceLabel(source: JobSource): string {
  switch (source) {
    case "chrome-extension":
      return "Chrome";
    case "gmail":
      return "Gmail";
    case "linkedin":
      return "LinkedIn";
    case "indeed":
      return "Indeed";
    case "manual":
      return "Manual";
    default:
      return source;
  }
}

export function remotePolicyLabel(policy: RemotePolicy): string {
  switch (policy) {
    case "remote":
      return "Remote";
    case "hybrid":
      return "Hybrid";
    case "onsite":
      return "On-site";
    default:
      return "Not specified";
  }
}
