// Read-only mirror of the profile schema owned by `src/app/profile/page.tsx`.
//
// The profile page keeps its own local `ProfileData` type and does not export it (it's a large,
// self-contained component). Rather than refactor that file, this module mirrors the same shape
// so the resume-generation flow (career-ai.ts + the generate-resume API route) can read the
// user's stored profile out of localStorage without depending on the profile page's internals.
//
// If you add/rename a field on the profile page's `ProfileData`, mirror the change here too.

import { PROFILE_STORAGE_KEY } from "@/lib/preferences";

export type CareerPreference = "job" | "internship" | "both";
export type ProjectType = "hobby" | "company";
export type GradingType = "GPA" | "CGPA" | "Percentage";

export type EducationRecord = {
  id: string;
  institute: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  isPursuing: boolean;
  gradingType: GradingType;
  score: string;
};

export type ExperienceRecord = {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  skillsGained: string;
};

export type ProjectRecord = {
  id: string;
  title: string;
  projectType: ProjectType;
  startDate: string;
  endDate: string;
  description: string;
  techStack: string;
  skillsGained: string;
};

export type CertificationRecord = {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  fileName: string;
};

export type ProfileData = {
  photoURL: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: string;
  location: string;
  profileSummary: string;
  careerPreference: CareerPreference;
  availabilityDateTime: string;
  expectedSalary: string;
  preferredLocations: string;
  blockedCompanies: string;
  keySkills: string;
  education: EducationRecord[];
  internships: ExperienceRecord[];
  employmentHistory: ExperienceRecord[];
  projects: ProjectRecord[];
  certifications: CertificationRecord[];
  awards: string[];
  clubsAndCommittees: string[];
  academicAchievements: string[];
  updatedAt: string;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asGradingType(value: unknown): GradingType {
  return value === "GPA" || value === "CGPA" || value === "Percentage" ? value : "CGPA";
}

function asProjectType(value: unknown): ProjectType {
  return value === "company" ? "company" : "hobby";
}

function asCareerPreference(value: unknown): CareerPreference {
  return value === "job" || value === "internship" || value === "both" ? value : "both";
}

function toEducationRecord(raw: unknown): EducationRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  return {
    id: asString(record.id),
    institute: asString(record.institute),
    degree: asString(record.degree),
    fieldOfStudy: asString(record.fieldOfStudy),
    startDate: asString(record.startDate),
    endDate: asString(record.endDate),
    isPursuing: asBoolean(record.isPursuing),
    gradingType: asGradingType(record.gradingType),
    score: asString(record.score)
  };
}

function toExperienceRecord(raw: unknown): ExperienceRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  return {
    id: asString(record.id),
    company: asString(record.company),
    role: asString(record.role),
    startDate: asString(record.startDate),
    endDate: asString(record.endDate),
    isCurrent: asBoolean(record.isCurrent),
    description: asString(record.description),
    skillsGained: asString(record.skillsGained)
  };
}

function toProjectRecord(raw: unknown): ProjectRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  return {
    id: asString(record.id),
    title: asString(record.title),
    projectType: asProjectType(record.projectType),
    startDate: asString(record.startDate),
    endDate: asString(record.endDate),
    description: asString(record.description),
    techStack: asString(record.techStack),
    skillsGained: asString(record.skillsGained)
  };
}

function toCertificationRecord(raw: unknown): CertificationRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  return {
    id: asString(record.id),
    title: asString(record.title),
    issuer: asString(record.issuer),
    issueDate: asString(record.issueDate),
    fileName: asString(record.fileName)
  };
}

function toRecordArray<T>(value: unknown, mapper: (raw: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const mapped = value.map(mapper);
  return mapped.filter((item): item is T => item !== null);
}

/**
 * Defensively coerces an arbitrary JSON value (e.g. a request body from an untrusted client)
 * into a well-formed ProfileData object. Missing/malformed fields fall back to safe empty
 * defaults rather than throwing, mirroring the profile page's own `hydrateProfile()` pattern.
 * Returns null only if `raw` isn't an object at all.
 */
export function sanitizeProfileData(raw: unknown): ProfileData | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;

  return {
    photoURL: asString(candidate.photoURL),
    fullName: asString(candidate.fullName),
    email: asString(candidate.email),
    phone: asString(candidate.phone),
    birthDate: asString(candidate.birthDate),
    gender: asString(candidate.gender),
    location: asString(candidate.location),
    profileSummary: asString(candidate.profileSummary),
    careerPreference: asCareerPreference(candidate.careerPreference),
    availabilityDateTime: asString(candidate.availabilityDateTime),
    expectedSalary: asString(candidate.expectedSalary),
    preferredLocations: asString(candidate.preferredLocations),
    blockedCompanies: asString(candidate.blockedCompanies),
    keySkills: asString(candidate.keySkills),
    education: toRecordArray(candidate.education, toEducationRecord),
    internships: toRecordArray(candidate.internships, toExperienceRecord),
    employmentHistory: toRecordArray(candidate.employmentHistory, toExperienceRecord),
    projects: toRecordArray(candidate.projects, toProjectRecord),
    certifications: toRecordArray(candidate.certifications, toCertificationRecord),
    awards: asStringArray(candidate.awards),
    clubsAndCommittees: asStringArray(candidate.clubsAndCommittees),
    academicAchievements: asStringArray(candidate.academicAchievements),
    updatedAt: asString(candidate.updatedAt)
  };
}

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Checks whether a profile has enough real detail for Career AI to write a tailored resume from -
 * not just empty placeholder rows. Requires at least one experience/project entry that has both an
 * identifying field (company+role, or a title) AND some descriptive text (description or skills
 * gained), or at least one education entry with an institute and degree. A profile with a company
 * name but no description, for example, does not count - there'd be nothing for the AI to work with.
 */
export function hasMeaningfulProfileContent(profile: ProfileData): boolean {
  const hasExperienceSignal = [...profile.internships, ...profile.employmentHistory].some(
    (entry) => hasText(entry.company) && hasText(entry.role) && (hasText(entry.description) || hasText(entry.skillsGained))
  );

  const hasProjectSignal = profile.projects.some(
    (entry) => hasText(entry.title) && (hasText(entry.description) || hasText(entry.skillsGained))
  );

  const hasEducationSignal = profile.education.some((entry) => hasText(entry.institute) && hasText(entry.degree));

  return hasExperienceSignal || hasProjectSignal || hasEducationSignal;
}

/**
 * Reads and defensively parses the user's profile out of localStorage.
 * Returns null if nothing is stored yet, or if the stored value is corrupted.
 * Read-only: this never writes back to storage.
 */
export function loadStoredProfile(): ProfileData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    return null;
  }

  return sanitizeProfileData(raw);
}
