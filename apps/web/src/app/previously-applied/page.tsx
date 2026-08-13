"use client";

import type { JobSkillCategory } from "@careeros/shared";
import {
  Archive,
  BriefcaseBusiness,
  ExternalLink,
  Eye,
  FileText,
  FileUp,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Save,
  Search
} from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { auth } from "@/lib/firebase/client";
import { createJobRecord, useUserJobs, type CareerJob } from "@/lib/firebase/jobs";
import { createUploadedResumeRecord, useUserResumes, type CareerResume } from "@/lib/firebase/resumes";
import { useUserVisualResumes } from "@/lib/firebase/visual-resumes";

type CompanySuggestion = {
  domain: string;
  logoUrl: string;
  name: string;
};

type ProfileFileAttachment = {
  id: string;
  contentType: string;
  kind: string;
  name: string;
  r2Key: string;
  signedUrl?: string;
  size: number;
  uploadedAt: string;
};

type ResumeOption = {
  contentType?: string;
  fileName?: string;
  fileR2Key?: string;
  fileUrl?: string;
  id: string;
  label: string;
  source: "resume" | "visual";
};

type ResumeAttachmentMode = "upload" | "library";

type PreviewState = {
  job: CareerJob;
  url: string;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getAuthHeaders(user: User): Promise<HeadersInit> {
  const idToken = await user.getIdToken(true);
  return {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json"
  };
}

function buildResumeHaystack(
  job: CareerJob,
  resumeOptionsWithData: { careerResumes: ReturnType<typeof useUserResumes>["resumes"]; visualResumes: ReturnType<typeof useUserVisualResumes>["resumes"] }
): string {
  if (!job.resumeVersionId) {
    return "";
  }

  if (job.resumeSource === "visual") {
    const resume = resumeOptionsWithData.visualResumes.find((entry) => entry.id === job.resumeVersionId);
    return resume ? resume.data.skills.flatMap((group) => group.items).join(" ").toLowerCase() : "";
  }

  const resume = resumeOptionsWithData.careerResumes.find((entry) => entry.id === job.resumeVersionId);
  return resume ? resume.bulletHighlights.join(" ").toLowerCase() : "";
}

function isPdfResumeFile(contentType: string | undefined, fileName: string | undefined): boolean {
  return contentType === "application/pdf" || Boolean(fileName?.toLowerCase().endsWith(".pdf"));
}

function canPreviewSubmittedResume(job: CareerJob): boolean {
  return Boolean(
    (job.submittedResumeR2Key || job.submittedResumeUrl) &&
      isPdfResumeFile(job.submittedResumeContentType, job.submittedResumeFileName)
  );
}

function selectedResumeOption(resumeChoice: string, options: ResumeOption[]): ResumeOption | null {
  if (!resumeChoice) {
    return null;
  }

  const [source, id] = resumeChoice.split(":");
  return options.find((option) => option.source === source && option.id === id) ?? null;
}

function getResumeOptionMeta(option: ResumeOption | null) {
  if (!option) {
    return null;
  }

  return {
    resumeSource: option.source,
    resumeVersionId: option.id,
    submittedResumeContentType: option.contentType,
    submittedResumeFileName: option.fileName || option.label,
    submittedResumeR2Key: option.fileR2Key,
    submittedResumeUrl: option.fileUrl
  };
}

function getSubmittedResumeLabel(job: CareerJob): string {
  return job.submittedResumeFileName || (job.resumeVersionId ? "Saved resume" : "No resume linked");
}

function countSkills(skillCategories: JobSkillCategory[]): number {
  return skillCategories.reduce((sum, entry) => sum + entry.items.length, 0);
}

export default function PreviouslyAppliedPage() {
  const [activeUser, setActiveUser] = useState<User | null>(auth?.currentUser ?? null);
  const { jobs } = useUserJobs();
  const { resumes: careerResumes } = useUserResumes();
  const { resumes: visualResumes } = useUserVisualResumes();

  const resumeOptions = useMemo<ResumeOption[]>(() => {
    const fromCareer = careerResumes.map((resume: CareerResume) => ({
      contentType: resume.contentType,
      fileName: resume.fileName,
      fileR2Key: resume.fileR2Key,
      fileUrl: resume.fileUrl,
      id: resume.id,
      label: resume.label,
      source: "resume" as const
    }));
    const fromVisual = visualResumes.map((resume) => ({
      id: resume.id,
      label: resume.label,
      source: "visual" as const
    }));

    return [...fromCareer, ...fromVisual];
  }, [careerResumes, visualResumes]);

  const [company, setCompany] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [companySuggestions, setCompanySuggestions] = useState<CompanySuggestion[]>([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const companySearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [appliedAt, setAppliedAt] = useState(todayIsoDate());
  const [jdText, setJdText] = useState("");
  const [notes, setNotes] = useState("");
  const [resumeAttachmentMode, setResumeAttachmentMode] = useState<ResumeAttachmentMode>("upload");
  const [resumeChoice, setResumeChoice] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewBusyJobId, setPreviewBusyJobId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      return;
    }

    return onAuthStateChanged(auth, setActiveUser);
  }, []);

  useEffect(
    () => () => {
      if (companySearchTimeoutRef.current) {
        clearTimeout(companySearchTimeoutRef.current);
      }
    },
    []
  );

  const selectedResume = useMemo(() => selectedResumeOption(resumeChoice, resumeOptions), [resumeChoice, resumeOptions]);
  const manualJobs = useMemo(() => jobs.filter((job) => job.source === "manual"), [jobs]);

  const handleCompanyChange = (value: string) => {
    setCompany(value);
    setShowCompanySuggestions(true);

    if (companySearchTimeoutRef.current) {
      clearTimeout(companySearchTimeoutRef.current);
    }

    if (!activeUser || value.trim().length < 2) {
      setCompanySuggestions([]);
      return;
    }

    companySearchTimeoutRef.current = setTimeout(async () => {
      try {
        const headers = await getAuthHeaders(activeUser);
        const response = await fetch(`/api/companies/search?q=${encodeURIComponent(value.trim())}`, { headers });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { results?: CompanySuggestion[] };
        setCompanySuggestions(payload.results ?? []);
      } catch {
        // Autocomplete is optional; free-text company names still work.
      }
    }, 300);
  };

  const handleSelectCompany = (suggestion: CompanySuggestion) => {
    setCompany(suggestion.name);
    setCompanyLogoUrl(suggestion.logoUrl);
    setCompanySuggestions([]);
    setShowCompanySuggestions(false);
  };

  const handleResumeFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMessage("Upload the submitted resume as a PDF so CareerOS can preview it inline.");
      setResumeFile(null);
      return;
    }

    setResumeFile(file);
    setResumeChoice("");
    setErrorMessage(null);
  };

  const uploadSubmittedResume = async (user: User): Promise<{
    attachment: ProfileFileAttachment;
    resumeVersionId: string;
  }> => {
    if (!resumeFile) {
      throw new Error("Choose the submitted PDF first.");
    }

    const idToken = await user.getIdToken(true);
    const formData = new FormData();
    formData.append("file", resumeFile);
    formData.append("kind", "submitted-resume");

    const response = await fetch("/api/profile/files", {
      body: formData,
      headers: { authorization: `Bearer ${idToken}` },
      method: "POST"
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      file?: ProfileFileAttachment;
    };

    if (!response.ok || !payload.file) {
      throw new Error(payload.error || "Unable to upload submitted resume.");
    }

    const resumeVersionId = await createUploadedResumeRecord(user.uid, {
      contentType: payload.file.contentType,
      fileName: payload.file.name,
      fileR2Key: payload.file.r2Key,
      fileSize: payload.file.size,
      fileUrl: payload.file.signedUrl,
      label: `${company.trim() || "Application"} - ${role.trim() || "Submitted"} resume`
    });

    return {
      attachment: payload.file,
      resumeVersionId
    };
  };

  const extractSkills = async (user: User): Promise<JobSkillCategory[]> => {
    try {
      const headers = await getAuthHeaders(user);
      const skillsResponse = await fetch("/api/ai/job-skills", {
        method: "POST",
        headers,
        body: JSON.stringify({ jdText: jdText.trim() })
      });

      if (!skillsResponse.ok) {
        return [];
      }

      const skillsPayload = (await skillsResponse.json().catch(() => ({}))) as { skillCategories?: JobSkillCategory[] };
      return Array.isArray(skillsPayload.skillCategories) ? skillsPayload.skillCategories : [];
    } catch {
      return [];
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeUser) {
      setErrorMessage("Please sign in again to log an application.");
      return;
    }

    if (jdText.trim().length < 30) {
      setErrorMessage("Paste the job description so the archive has enough context.");
      return;
    }

    if (resumeAttachmentMode === "upload" && !resumeFile) {
      setErrorMessage("Upload the submitted resume PDF before saving.");
      return;
    }

    if (resumeAttachmentMode === "library" && !selectedResume) {
      setErrorMessage("Choose the resume version that was submitted.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const [skillCategories, uploadedResume] = await Promise.all([
        extractSkills(activeUser),
        resumeAttachmentMode === "upload" ? uploadSubmittedResume(activeUser) : Promise.resolve(null)
      ]);

      const selectedMeta = resumeAttachmentMode === "library" ? getResumeOptionMeta(selectedResume) : null;
      const uploadedMeta = uploadedResume
        ? {
            resumeSource: "resume" as const,
            resumeVersionId: uploadedResume.resumeVersionId,
            submittedResumeContentType: uploadedResume.attachment.contentType,
            submittedResumeFileName: uploadedResume.attachment.name,
            submittedResumeR2Key: uploadedResume.attachment.r2Key,
            submittedResumeUploadedAt: uploadedResume.attachment.uploadedAt,
            submittedResumeUrl: uploadedResume.attachment.signedUrl
          }
        : null;

      await createJobRecord(activeUser.uid, {
        appliedAt: new Date(appliedAt).toISOString(),
        company: company.trim(),
        companyLogoUrl: companyLogoUrl.trim() || undefined,
        jdSkillCategories: skillCategories,
        jdText: jdText.trim(),
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        role: role.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
        ...(selectedMeta ?? {}),
        ...(uploadedMeta ?? {})
      });

      const skillsFound = countSkills(skillCategories);
      setNotice(
        skillsFound > 0
          ? `Application logged with ${skillsFound} extracted skills.`
          : "Application logged. Skill extraction can be refreshed later."
      );
      setCompany("");
      setCompanyLogoUrl("");
      setRole("");
      setLocation("");
      setSourceUrl("");
      setJdText("");
      setNotes("");
      setResumeChoice("");
      setResumeFile(null);
      setAppliedAt(todayIsoDate());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to log this application.");
    } finally {
      setBusy(false);
    }
  };

  const getSubmittedResumeUrl = async (job: CareerJob): Promise<string> => {
    if (!activeUser) {
      throw new Error("Please sign in again to preview submitted resumes.");
    }

    if (job.submittedResumeR2Key) {
      const headers = await getAuthHeaders(activeUser);
      const response = await fetch("/api/profile/files/signed-url", {
        body: JSON.stringify({ r2Key: job.submittedResumeR2Key }),
        headers,
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; signedUrl?: string };

      if (!response.ok || !payload.signedUrl) {
        throw new Error(payload.error || "Unable to create a preview link.");
      }

      return payload.signedUrl;
    }

    if (job.submittedResumeUrl) {
      return job.submittedResumeUrl;
    }

    throw new Error("This application does not have a previewable PDF attached.");
  };

  const openResumePreview = async (job: CareerJob) => {
    if (!canPreviewSubmittedResume(job)) {
      setErrorMessage("This application does not have a PDF resume attached.");
      return;
    }

    setPreviewBusyJobId(job.id);
    setErrorMessage(null);

    try {
      const url = await getSubmittedResumeUrl(job);
      setPreviewState({ job, url });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to preview submitted resume.");
    } finally {
      setPreviewBusyJobId(null);
    }
  };

  return (
    <div className="page-stack">
      <section className="manual-application-layout">
        <section className="career-card manual-application-form-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Application Archive</p>
              <h2>Log a submitted role</h2>
              <p>Keep the job description and exact resume together for interview callbacks.</p>
            </div>
          </div>

          <form className="manual-application-form" onSubmit={handleSubmit}>
            <div className="manual-application-grid">
              <label className="profile-field manual-company-field">
                Company
                <span className="manual-company-input-wrap">
                  <Search size={15} />
                  <input
                    autoComplete="off"
                    onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 150)}
                    onChange={(event) => handleCompanyChange(event.target.value)}
                    onFocus={() => setShowCompanySuggestions(true)}
                    placeholder="Company name"
                    required
                    type="text"
                    value={company}
                  />
                </span>
                {showCompanySuggestions && companySuggestions.length > 0 ? (
                  <div className="company-suggestions">
                    {companySuggestions.map((suggestion) => (
                      <button
                        className="company-suggestion-row"
                        key={suggestion.domain}
                        onClick={() => handleSelectCompany(suggestion)}
                        type="button"
                      >
                        <CompanyAvatar company={suggestion.name} logoUrl={suggestion.logoUrl} toneClassName="brand" />
                        <span>
                          {suggestion.name}
                          <small>{suggestion.domain}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>

              <label className="profile-field">
                Logo link
                <input
                  onChange={(event) => setCompanyLogoUrl(event.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={companyLogoUrl}
                />
              </label>

              <label className="profile-field">
                Role
                <input
                  onChange={(event) => setRole(event.target.value)}
                  placeholder="Senior Frontend Engineer"
                  required
                  type="text"
                  value={role}
                />
              </label>

              <label className="profile-field">
                Location
                <input
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Remote, Bengaluru, New York..."
                  type="text"
                  value={location}
                />
              </label>

              <label className="profile-field">
                Applied on
                <input onChange={(event) => setAppliedAt(event.target.value)} required type="date" value={appliedAt} />
              </label>

              <label className="profile-field">
                Job post link
                <input
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={sourceUrl}
                />
              </label>
            </div>

            <section className="manual-resume-panel">
              <div className="manual-panel-heading">
                <div>
                  <p className="eyebrow">Submitted Resume</p>
                  <h3>Attach the version used</h3>
                </div>
                <div className="segmented-control" aria-label="Resume attachment mode">
                  <button
                    className={resumeAttachmentMode === "upload" ? "segmented-button active" : "segmented-button"}
                    onClick={() => {
                      setResumeAttachmentMode("upload");
                      setResumeChoice("");
                    }}
                    type="button"
                  >
                    <FileUp size={14} />
                    Upload PDF
                  </button>
                  <button
                    className={resumeAttachmentMode === "library" ? "segmented-button active" : "segmented-button"}
                    onClick={() => {
                      setResumeAttachmentMode("library");
                      setResumeFile(null);
                    }}
                    type="button"
                  >
                    <Archive size={14} />
                    From Gallery
                  </button>
                </div>
              </div>

              {resumeAttachmentMode === "upload" ? (
                <label className="manual-file-drop">
                  <FileUp size={18} />
                  <span>{resumeFile ? resumeFile.name : "Choose submitted resume PDF"}</span>
                  <input accept="application/pdf,.pdf" onChange={handleResumeFileChange} type="file" />
                </label>
              ) : (
                <label className="profile-field">
                  Resume version
                  <select onChange={(event) => setResumeChoice(event.target.value)} value={resumeChoice}>
                    <option value="">Choose a saved resume</option>
                    {resumeOptions.map((option) => (
                      <option key={`${option.source}:${option.id}`} value={`${option.source}:${option.id}`}>
                        {option.label} {option.source === "visual" ? "(Visual Mode)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {selectedResume && !isPdfResumeFile(selectedResume.contentType, selectedResume.fileName) ? (
                <p className="settings-feedback">
                  This resume will be linked to the application. Upload a PDF if you want inline preview for this role.
                </p>
              ) : null}
            </section>

            <label className="profile-field">
              Job description
              <textarea
                onChange={(event) => setJdText(event.target.value)}
                placeholder="Paste the full job description."
                required
                rows={10}
                value={jdText}
              />
            </label>

            <label className="profile-field">
              Notes
              <textarea
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Referral, recruiter, submission context..."
                rows={3}
                value={notes}
              />
            </label>

            {notice ? <p className="settings-feedback success">{notice}</p> : null}
            {errorMessage ? <p className="settings-feedback error">{errorMessage}</p> : null}

            <div className="manual-form-actions">
              <Link className="ghost-button" href="/applications">
                <BriefcaseBusiness size={14} />
                Board
              </Link>
              <button className="primary-button" disabled={busy || !activeUser} type="submit">
                {busy ? <Loader2 className="spin-icon" size={15} /> : <Save size={15} />}
                {busy ? "Saving..." : "Save application"}
              </button>
            </div>
          </form>
        </section>

        <aside className="manual-application-side">
          <section className="career-card manual-application-preview-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Preview</p>
                <h2>{role || "Untitled role"}</h2>
                <p>{company || "Company not set"}</p>
              </div>
              <CompanyAvatar company={company || "Company"} logoUrl={companyLogoUrl} toneClassName="brand" />
            </div>
            <div className="manual-preview-facts">
              <span>
                <MapPin size={13} />
                {location || "Location not listed"}
              </span>
              <span>
                <FileText size={13} />
                {resumeFile?.name || selectedResume?.label || "No resume selected"}
              </span>
              {sourceUrl ? (
                <a href={sourceUrl} rel="noreferrer" target="_blank">
                  <LinkIcon size={13} />
                  Job post
                </a>
              ) : null}
            </div>
          </section>

          <section className="career-card manual-application-preview-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Logged</p>
                <h2>{manualJobs.length} manual applications</h2>
                <p>Manual records join the same Kanban board as extension captures.</p>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="career-card settings-panel-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Application Archive</p>
            <h2>Submitted roles</h2>
            <p>Review the exact JD, attached resume, and extracted skill signals.</p>
          </div>
        </div>

        {manualJobs.length === 0 ? (
          <p className="settings-feedback">No manual applications logged yet.</p>
        ) : (
          <div className="manual-application-list">
            {manualJobs.map((job) => {
              const haystack = buildResumeHaystack(job, { careerResumes, visualResumes });
              const skillCategories = job.jdSkillCategories ?? [];
              return (
                <article className="manual-application-entry" key={job.id}>
                  <div className="manual-entry-heading">
                    <div className="previously-applied-entry-header">
                      <CompanyAvatar company={job.company} logoUrl={job.companyLogoUrl} toneClassName="brand" />
                      <div>
                        <h3>{job.role}</h3>
                        <p>
                          {job.company} / Applied {new Date(job.appliedAt || job.savedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>

                  <div className="manual-entry-actions">
                    {job.sourceUrl ? (
                      <a className="ghost-button" href={job.sourceUrl} rel="noopener noreferrer" target="_blank">
                        <ExternalLink size={13} />
                        Job Post
                      </a>
                    ) : null}
                    {canPreviewSubmittedResume(job) ? (
                      <button
                        className="ghost-button"
                        disabled={previewBusyJobId === job.id}
                        onClick={() => {
                          void openResumePreview(job);
                        }}
                        type="button"
                      >
                        {previewBusyJobId === job.id ? <Loader2 className="spin-icon" size={13} /> : <Eye size={13} />}
                        View Resume
                      </button>
                    ) : (
                      <span className="pill">{getSubmittedResumeLabel(job)}</span>
                    )}
                    <Link className="ghost-button" href="/applications">
                      <BriefcaseBusiness size={13} />
                      Kanban
                    </Link>
                  </div>

                  <div className="manual-entry-jd">
                    <strong>Job Description</strong>
                    <p>{job.jdText || "No job description saved."}</p>
                  </div>

                  {skillCategories.length > 0 ? (
                    <div className="manual-skill-groups">
                      {skillCategories.map((category) => (
                        <div className="previously-applied-skill-group" key={category.category}>
                          <p className="previously-applied-skill-category">{category.category}</p>
                          <div className="previously-applied-skill-chips">
                            {category.items.map((skill) => {
                              const matched = haystack.length > 0 && haystack.includes(skill.toLowerCase());
                              return (
                                <span className={matched ? "pill success" : "pill warning"} key={skill}>
                                  {skill}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {previewState ? (
        <div className="profile-modal-overlay" onClick={() => setPreviewState(null)} role="presentation">
          <section
            aria-labelledby="submitted-resume-preview-title"
            aria-modal="true"
            className="profile-modal submitted-resume-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="card-header">
              <div>
                <p className="eyebrow">Submitted Resume</p>
                <h2 id="submitted-resume-preview-title">{getSubmittedResumeLabel(previewState.job)}</h2>
                <p>
                  {previewState.job.role} / {previewState.job.company}
                </p>
              </div>
              <a className="ghost-button" href={previewState.url} rel="noreferrer" target="_blank">
                <ExternalLink size={14} />
                Open
              </a>
            </div>
            <iframe className="submitted-resume-frame" src={previewState.url} title="Submitted resume PDF preview" />
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setPreviewState(null)} type="button">
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
