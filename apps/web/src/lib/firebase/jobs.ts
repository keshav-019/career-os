"use client";

import type { JobRecord, JobSkillCategory, JobSource, JobStatus } from "@careeros/shared";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";

export type CareerJob = JobRecord & {
  aboutText?: string;
  createdAt?: string;
  eligibilityText?: string;
  employmentType?: string;
  experienceText?: string;
  interviewReminderId?: string;
  jobTypeText?: string;
  locationOptions?: string[];
  postedAtText?: string;
  responsibilitiesText?: string;
  salaryText?: string;
  skills?: string[];
  updatedAt?: string;
  workplaceTypeText?: string;
};

const STATUS_VALUES = new Set<JobStatus>(["saved", "applied", "interviewing", "offer", "rejected", "archived"]);
const PRIORITY_VALUES = new Set<CareerJob["priority"]>(["low", "medium", "high"]);
const REMOTE_POLICY_VALUES = new Set<CareerJob["remotePolicy"]>(["remote", "hybrid", "onsite", "unknown"]);
const SOURCE_VALUES = new Set<JobSource>([
  "manual",
  "chrome-extension",
  "gmail",
  "linkedin",
  "indeed",
  "greenhouse",
  "lever",
  "other"
]);

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeHttpUrl(value: unknown): string {
  const raw = asString(value);
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

function asIsoString(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      const date = value.toDate() as Date;
      const parsed = date.getTime();
      return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
    } catch {
      return "";
    }
  }

  return "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asString(entry))
    .filter(Boolean)
    .slice(0, 40);
}

function asJobSkillCategories(value: unknown): JobSkillCategory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry): JobSkillCategory | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const category = asString(record.category);
      const items = asStringArray(record.items).slice(0, 30);

      if (!category || items.length === 0) {
        return null;
      }

      return {
        category,
        items
      };
    })
    .filter((entry): entry is JobSkillCategory => Boolean(entry))
    .slice(0, 20);
}

function asResumeSource(value: unknown): JobRecord["resumeSource"] | undefined {
  const candidate = asString(value);
  return candidate === "resume" || candidate === "visual" ? candidate : undefined;
}

function parseCareerJob(snapshot: QueryDocumentSnapshot<DocumentData>): CareerJob {
  const data = snapshot.data() as Record<string, unknown>;
  const id = asString(data.id) || snapshot.id;
  const savedAt = asIsoString(data.savedAt) || asIsoString(data.createdAt) || new Date().toISOString();
  const statusCandidate = asString(data.status) as JobStatus;
  const remotePolicyCandidate = asString(data.remotePolicy) as CareerJob["remotePolicy"];
  const priorityCandidate = asString(data.priority) as CareerJob["priority"];
  const sourceCandidate = asString(data.source) as JobSource;

  return {
    id,
    userId: asString(data.userId),
    company: asString(data.company) || "Unknown company",
    companyLogoUrl: sanitizeHttpUrl(data.companyLogoUrl) || undefined,
    role: asString(data.role) || "Untitled role",
    location: asString(data.location) || "Not listed",
    locationOptions: asStringArray(data.locationOptions),
    remotePolicy: REMOTE_POLICY_VALUES.has(remotePolicyCandidate) ? remotePolicyCandidate : "unknown",
    source: SOURCE_VALUES.has(sourceCandidate) ? sourceCandidate : "other",
    sourceUrl: sanitizeHttpUrl(data.sourceUrl) || undefined,
    status: STATUS_VALUES.has(statusCandidate) ? statusCandidate : "saved",
    priority: PRIORITY_VALUES.has(priorityCandidate) ? priorityCandidate : "medium",
    fitScore: Math.max(0, Math.min(100, Math.round(asNumber(data.fitScore)))),
    savedAt,
    appliedAt: asIsoString(data.appliedAt) || undefined,
    nextActionAt: asIsoString(data.nextActionAt) || undefined,
    jdSkillCategories: asJobSkillCategories(data.jdSkillCategories),
    resumeSource: asResumeSource(data.resumeSource),
    resumeVersionId: asString(data.resumeVersionId) || undefined,
    submittedResumeContentType: asString(data.submittedResumeContentType) || undefined,
    submittedResumeFileName: asString(data.submittedResumeFileName) || undefined,
    submittedResumeR2Key: asString(data.submittedResumeR2Key) || undefined,
    submittedResumeUploadedAt: asIsoString(data.submittedResumeUploadedAt) || undefined,
    submittedResumeUrl: sanitizeHttpUrl(data.submittedResumeUrl) || undefined,
    tags: asStringArray(data.tags),
    jdText: asString(data.jdText) || undefined,
    notes: asString(data.notes) || undefined,
    createdAt: asIsoString(data.createdAt) || undefined,
    postedAtText: asString(data.postedAtText) || undefined,
    workplaceTypeText: asString(data.workplaceTypeText) || undefined,
    jobTypeText: asString(data.jobTypeText) || undefined,
    employmentType: asString(data.employmentType) || undefined,
    experienceText: asString(data.experienceText) || undefined,
    salaryText: asString(data.salaryText) || undefined,
    aboutText: asString(data.aboutText) || undefined,
    responsibilitiesText: asString(data.responsibilitiesText) || undefined,
    eligibilityText: asString(data.eligibilityText) || undefined,
    skills: asStringArray(data.skills),
    interviewReminderId: asString(data.interviewReminderId) || undefined,
    updatedAt: asIsoString(data.updatedAt) || undefined
  };
}

function compactRecord<T extends Record<string, unknown>>(record: T): T {
  const compacted = {} as T;

  Object.entries(record).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    compacted[key as keyof T] = value as T[keyof T];
  });

  return compacted;
}

function sortJobsBySavedAtDescending(jobs: CareerJob[]): CareerJob[] {
  return [...jobs].sort((first, second) => {
    const firstDate = Date.parse(first.savedAt);
    const secondDate = Date.parse(second.savedAt);

    return secondDate - firstDate;
  });
}

export function useUserJobs() {
  const hasAuth = Boolean(auth);
  const hasDb = Boolean(db);
  const [jobs, setJobs] = useState<CareerJob[]>([]);
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [loading, setLoading] = useState(hasAuth && hasDb);
  const [error, setError] = useState<string | null>(
    !hasAuth ? "Firebase authentication is not configured." : !hasDb ? "Firestore is not configured." : null
  );

  useEffect(() => {
    if (!auth || !db) {
      return;
    }

    let unsubscribeJobs: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (unsubscribeJobs) {
        unsubscribeJobs();
        unsubscribeJobs = null;
      }

      setUser(authUser);

      if (!authUser) {
        setJobs([]);
        setLoading(false);
        setError(null);
        return;
      }

      if (!db) {
        setJobs([]);
        setLoading(false);
        setError("Firestore is not configured.");
        return;
      }

      setLoading(true);
      setError(null);

      unsubscribeJobs = onSnapshot(
        collection(db, "users", authUser.uid, "jobs"),
        (snapshot) => {
          const parsedJobs = snapshot.docs.map((docSnapshot) => parseCareerJob(docSnapshot));
          setJobs(sortJobsBySavedAtDescending(parsedJobs));
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          setJobs([]);
          setLoading(false);
          setError(snapshotError.message || "Failed to load job records.");
        }
      );
    });

    return () => {
      if (unsubscribeJobs) {
        unsubscribeJobs();
      }

      unsubscribeAuth();
    };
  }, []);

  return {
    error,
    jobs,
    loading,
    user
  };
}

export type JobCreatePayload = {
  appliedAt?: string;
  company: string;
  companyLogoUrl?: string;
  fitScore?: number;
  jdSkillCategories?: JobSkillCategory[];
  jdText?: string;
  location?: string;
  notes?: string;
  remotePolicy?: CareerJob["remotePolicy"];
  resumeSource?: JobRecord["resumeSource"];
  resumeVersionId?: string;
  role: string;
  sourceUrl?: string;
  submittedResumeContentType?: string;
  submittedResumeFileName?: string;
  submittedResumeR2Key?: string;
  submittedResumeUploadedAt?: string;
  submittedResumeUrl?: string;
  tags?: string[];
};

export async function createJobRecord(userId: string, payload: JobCreatePayload): Promise<string> {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  const nowIso = new Date().toISOString();
  const appliedAt = asIsoString(payload.appliedAt) || nowIso;
  const remotePolicy = REMOTE_POLICY_VALUES.has(payload.remotePolicy ?? "unknown") ? payload.remotePolicy ?? "unknown" : "unknown";
  const normalizedSkills = asJobSkillCategories(payload.jdSkillCategories);
  const normalizedTags = Array.from(new Set(["manual", "applied", ...asStringArray(payload.tags)])).slice(0, 20);

  const jobRef = await addDoc(
    collection(db, "users", userId, "jobs"),
    compactRecord({
      appliedAt,
      company: asString(payload.company) || "Unknown company",
      companyLogoUrl: sanitizeHttpUrl(payload.companyLogoUrl) || undefined,
      createdAt: nowIso,
      fitScore: Math.max(0, Math.min(100, Math.round(asNumber(payload.fitScore)))),
      jdSkillCategories: normalizedSkills,
      jdText: asString(payload.jdText).slice(0, 30000),
      location: asString(payload.location) || "Not listed",
      notes: asString(payload.notes).slice(0, 3000) || undefined,
      priority: "medium",
      remotePolicy,
      resumeSource: payload.resumeSource,
      resumeVersionId: asString(payload.resumeVersionId) || undefined,
      role: asString(payload.role) || "Untitled role",
      savedAt: nowIso,
      source: "manual",
      sourceUrl: sanitizeHttpUrl(payload.sourceUrl) || undefined,
      status: "applied",
      submittedResumeContentType: asString(payload.submittedResumeContentType) || undefined,
      submittedResumeFileName: asString(payload.submittedResumeFileName) || undefined,
      submittedResumeR2Key: asString(payload.submittedResumeR2Key) || undefined,
      submittedResumeUploadedAt: asIsoString(payload.submittedResumeUploadedAt) || undefined,
      submittedResumeUrl: sanitizeHttpUrl(payload.submittedResumeUrl) || undefined,
      tags: normalizedTags,
      updatedAt: nowIso,
      userId
    })
  );

  await updateDoc(jobRef, { id: jobRef.id });
  return jobRef.id;
}

export type JobUpdatePayload = Partial<{
  appliedAt: string | null;
  interviewReminderId: string | null;
  nextActionAt: string | null;
  notes: string | null;
  status: JobStatus;
}>;

export async function updateJobRecord(userId: string, jobId: string, updates: JobUpdatePayload) {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  const payload: Record<string, unknown> = {
    updatedAt: new Date().toISOString()
  };

  Object.entries(updates).forEach(([key, value]) => {
    if (typeof value === "undefined") {
      return;
    }

    payload[key] = value === null ? deleteField() : value;
  });

  await updateDoc(doc(db, "users", userId, "jobs", jobId), payload);
}

export async function deleteJobRecord(userId: string, jobId: string) {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  await deleteDoc(doc(db, "users", userId, "jobs", jobId));
}
