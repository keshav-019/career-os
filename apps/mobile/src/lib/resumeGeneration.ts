import { apiPost } from "./apiClient";
import type { CareerJob } from "../types/job";
import { makeLocalId, type ProfileData } from "../types/profile";
import type { ResumeData } from "../types/resume";

/** Thin wrapper around the deployed web app's apps/web/src/app/api/ai/generate-resume/route.ts. Generates a
 *  Visual Mode resume tailored to one saved job, fresh every call - nothing is persisted by this call, and the
 *  caller (ResumeScreen) is expected to just load the result into its current editing session and never call
 *  saveMobileResume() with it automatically, matching the "on the spot generation every time" requirement. */

function jobToGenerateResumePayload(job: CareerJob): Record<string, unknown> {
  return {
    company: job.company || "",
    jdText: job.jdText || job.responsibilitiesText || job.eligibilityText || job.aboutText || "",
    location: job.location || "",
    role: job.role || "",
    tags: job.tags || []
  };
}

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Mirrors apps/web/src/lib/profile-data.ts's hasMeaningfulProfileContent() exactly - checks whether the
 *  profile has enough real detail (not just empty placeholder rows) for Career AI to write a tailored resume
 *  from, so callers can skip the AI call entirely and point the user back at their Profile instead. */
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

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Offline (no AI call, no network) mapping from Profile fields directly into a blank ResumeData - used when
 *  starting a brand-new resume from scratch, so the user isn't retyping everything they already put in Profile.
 *  Distinct from generateAtsResumeForJob() above, which calls the AI to tailor content for one specific job. */
export function profileToResumeData(profile: ProfileData): ResumeData {
  const [firstName = "", ...lastNameParts] = profile.fullName.trim().split(/\s+/).filter(Boolean);

  return {
    personal: {
      firstName,
      lastName: lastNameParts.join(" "),
      title: "",
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      linkedin: "",
      github: "",
      portfolio: "",
      summary: profile.profileSummary
    },
    education: profile.education.map((entry) => ({
      id: entry.id,
      institution: entry.institute,
      degree: entry.degree,
      field: entry.fieldOfStudy,
      startDate: entry.startDate,
      endDate: entry.isPursuing ? "" : entry.endDate,
      gpa: entry.score,
      description: ""
    })),
    experience: [...profile.employmentHistory, ...profile.internships].map((entry) => ({
      id: entry.id,
      company: entry.company,
      position: entry.role,
      location: "",
      startDate: entry.startDate,
      endDate: entry.isCurrent ? "" : entry.endDate,
      current: entry.isCurrent,
      description: entry.description ? [entry.description] : [""]
    })),
    skills: splitList(profile.keySkills).length > 0 ? [{ id: makeLocalId("skill"), category: "", items: splitList(profile.keySkills) }] : [],
    projects: profile.projects.map((entry) => ({
      id: entry.id,
      name: entry.title,
      description: entry.description,
      technologies: splitList(entry.techStack),
      link: ""
    })),
    certifications: profile.certifications.map((entry) => ({
      id: entry.id,
      name: entry.title,
      issuer: entry.issuer,
      date: entry.issueDate
    })),
    skillsColumns: 2
  };
}

export async function generateAtsResumeForJob(job: CareerJob, profile: ProfileData): Promise<ResumeData> {
  const result = await apiPost<{ error?: string; ok?: boolean; resume?: ResumeData }>("/api/ai/generate-resume", {
    job: jobToGenerateResumePayload(job),
    profile
  });

  if (!result.ok || !result.resume) {
    throw new Error(result.error || "Unable to generate a tailored resume.");
  }

  return result.resume;
}
