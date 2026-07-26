"use client";

import type { JobRecord, ResumeVersion } from "@careeros/shared";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Target,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { auth } from "@/lib/firebase/client";
import { useUserJobs, type CareerJob } from "@/lib/firebase/jobs";
import { useUserResumes } from "@/lib/firebase/resumes";

type AiStatus = {
  available: boolean;
  message: string;
};

type ResumeReview = {
  atsKeywords: string[];
  gaps: string[];
  latexOrVisualNotes: string[];
  marketPosition: string;
  overallScore: number;
  recruiterSummary: string;
  strengths: string[];
  targetRoles: string[];
};

type JobMatch = {
  applicationStrategy: string[];
  bestResumeId: string;
  bestResumeLabel: string;
  coverLetter: string;
  gaps: string[];
  matchedEvidence: string[];
  outreachMessage: string;
  recommendedJobTargets: string[];
  resumeTweaks: string[];
  scoreOutOf10: number;
  verdict: string;
};

type JobDraft = {
  company: string;
  description: string;
  location: string;
  role: string;
  tags: string;
};

type ResumeExtractResponse = {
  characterCount?: number;
  error?: string;
  fileName?: string;
  ok?: boolean;
  text?: string;
};

const emptyJobDraft: JobDraft = {
  company: "",
  description: "",
  location: "",
  role: "",
  tags: ""
};

function toJobDraft(job: Partial<JobRecord> & CareerJob): JobDraft {
  return {
    company: job.company || "",
    description:
      job.jdText ||
      job.responsibilitiesText ||
      job.eligibilityText ||
      job.aboutText ||
      "",
    location: job.location || "",
    role: job.role || "",
    tags: job.tags?.join(", ") || ""
  };
}

function toJobPayload(draft: JobDraft): Partial<JobRecord> & Record<string, unknown> {
  return {
    company: draft.company,
    jdText: draft.description,
    location: draft.location,
    role: draft.role,
    tags: draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  };
}

function hasMeaningfulJobInput(draft: JobDraft): boolean {
  return Boolean(draft.role.trim() || draft.company.trim() || draft.description.trim() || draft.tags.trim());
}

function compactDate(value: string | undefined): string {
  if (!value) {
    return "No date";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(parsed));
}

function fileBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function fileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function normalizeUploadedResumeText(value: string): string {
  return value
    .replace(/\0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inferResumeHighlights(value: string): string[] {
  return normalizeUploadedResumeText(value)
    .split(/\n|(?<=\.)\s+/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => line.length >= 24)
    .slice(0, 5);
}

function inferResumeTargetRoles(value: string): string[] {
  const normalized = value.toLowerCase();
  const roles = [
    ["frontend", "Frontend Engineer"],
    ["full stack", "Full-Stack Engineer"],
    ["fullstack", "Full-Stack Engineer"],
    ["backend", "Backend Engineer"],
    ["machine learning", "Machine Learning Engineer"],
    ["data", "Data Analyst"],
    ["cloud", "Cloud Engineer"],
    ["devops", "DevOps Engineer"],
    ["product", "Product Engineer"]
  ]
    .filter(([needle]) => normalized.includes(needle))
    .map(([, role]) => role);

  return [...new Set(roles)].slice(0, 4);
}

function createLocalUploadedResume(label: string, fileName: string, text: string): ResumeVersion {
  const cleanText = normalizeUploadedResumeText(text);
  const now = new Date().toISOString();
  const isLatex = /\\documentclass|\\begin\{document\}/i.test(cleanText) || fileExtension(fileName) === "tex";
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `uploaded_${crypto.randomUUID()}`
      : `uploaded_${Date.now()}`;

  return {
    id,
    userId: "local-upload",
    label: label.trim() || fileBaseName(fileName) || "Uploaded resume",
    targetRoles: inferResumeTargetRoles(cleanText),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    bulletHighlights: inferResumeHighlights(cleanText),
    keywordCoverage: 0,
    editorMode: isLatex ? "latex" : "builder",
    latexCode: isLatex ? cleanText : undefined,
    pageCount: 1,
    sections: isLatex
      ? []
      : [
          {
            id: "uploaded_resume_text",
            title: "Uploaded Resume",
            contentHtml: "<p></p>",
            order: 0,
            page: 1,
            plainText: cleanText
          }
        ]
  };
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const idToken = await auth?.currentUser?.getIdToken().catch(() => null);
  const response = await fetch(url, {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      ...(idToken ? { authorization: `Bearer ${idToken}` } : {})
    },
    method: "POST"
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "AI request failed.");
  }

  return body as T;
}

function ResultList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="career-ai-muted">No items returned.</p>;
  }

  return (
    <ul className="career-ai-list">
      {items.map((item) => (
        <li key={item}>
          <CheckCircle2 size={14} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function AnalysisLoadingCard({ description, eyebrow, title }: { description: string; eyebrow: string; title: string }) {
  return (
    <section className="career-card career-ai-loading-card">
      <Loader2 className="spin" size={20} />
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}

export default function AiMatchPage() {
  const { jobs } = useUserJobs();
  const { error: resumesError, loading: resumesLoading, resumes } = useUserResumes();
  const [uploadedResumes, setUploadedResumes] = useState<ResumeVersion[]>([]);
  const availableJobs = jobs;
  const availableResumes = useMemo(() => [...uploadedResumes, ...resumes], [resumes, uploadedResumes]);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobDraft, setJobDraft] = useState<JobDraft>(emptyJobDraft);
  const [selectedResumeIds, setSelectedResumeIds] = useState<string[]>([]);
  const [extractingResume, setExtractingResume] = useState(false);
  const [uploadedResumeFileName, setUploadedResumeFileName] = useState("");
  const [uploadedResumeLabel, setUploadedResumeLabel] = useState("");
  const [uploadedResumeText, setUploadedResumeText] = useState("");
  const [review, setReview] = useState<ResumeReview | null>(null);
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [busyMode, setBusyMode] = useState<"match" | "review" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedResumes = availableResumes.filter((resume) => selectedResumeIds.includes(resume.id));
  const primaryResume = selectedResumes[0] ?? availableResumes[0] ?? null;
  const canAnalyzeMatch = selectedResumes.length > 0 && hasMeaningfulJobInput(jobDraft) && busyMode === null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryJobId = params.get("jobId");
    const initialJob = queryJobId ? availableJobs.find((job) => job.id === queryJobId) : null;

    if (initialJob && !selectedJobId) {
      setSelectedJobId(initialJob.id);
      setJobDraft(toJobDraft(initialJob));
    }
  }, [availableJobs, selectedJobId]);

  useEffect(() => {
    if (selectedResumeIds.length === 0 && availableResumes.length > 0) {
      setSelectedResumeIds(availableResumes.map((resume) => resume.id));
    }
  }, [availableResumes, selectedResumeIds.length]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ai/status")
      .then(async (response) => {
        const body = (await response.json()) as AiStatus;
        if (!cancelled) {
          setAiStatus(body);
        }
      })
      .catch((statusError) => {
        if (!cancelled) {
          setAiStatus({
            available: false,
            message: statusError instanceof Error ? statusError.message : "AI status check failed."
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSavedJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    const selectedJob = availableJobs.find((job) => job.id === jobId);
    setJobDraft(selectedJob ? toJobDraft(selectedJob) : emptyJobDraft);
  };

  const handleResumeFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setUploadedResumeFileName(file.name);
    setUploadedResumeLabel((current) => current || fileBaseName(file.name));
    setUploadedResumeText("");
    setError(null);
    setNotice(null);
    setExtractingResume(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const idToken = await auth?.currentUser?.getIdToken().catch(() => null);
      const response = await fetch("/api/resume/extract", {
        body: formData,
        headers: idToken ? { authorization: `Bearer ${idToken}` } : undefined,
        method: "POST"
      });
      const body = (await response.json().catch(() => ({}))) as ResumeExtractResponse;

      if (!response.ok || !body.text) {
        throw new Error(body.error || "Unable to extract text from this resume.");
      }

      setUploadedResumeText(normalizeUploadedResumeText(body.text));
      setNotice(`Extracted ${body.characterCount?.toLocaleString() || body.text.length.toLocaleString()} characters from ${file.name}.`);
    } catch (uploadError) {
      setUploadedResumeText("");
      setError(uploadError instanceof Error ? uploadError.message : "Resume extraction failed.");
    } finally {
      setExtractingResume(false);
    }
  };

  const handleAddUploadedResume = () => {
    const cleanText = normalizeUploadedResumeText(uploadedResumeText);
    if (!cleanText) {
      setError("Paste resume text or upload a .txt, .md, or .tex resume before adding it.");
      return;
    }

    const resume = createLocalUploadedResume(uploadedResumeLabel, uploadedResumeFileName, cleanText);
    setUploadedResumes((current) => [resume, ...current]);
    setSelectedResumeIds((current) => [resume.id, ...current.filter((resumeId) => resumeId !== resume.id)]);
    setUploadedResumeFileName("");
    setUploadedResumeLabel("");
    setUploadedResumeText("");
    setError(null);
    setNotice(`Added ${resume.label} for this AI session.`);
  };

  const toggleResume = (resumeId: string) => {
    setSelectedResumeIds((current) =>
      current.includes(resumeId) ? current.filter((id) => id !== resumeId) : [...current, resumeId]
    );
  };

  const handleReview = async () => {
    if (!primaryResume) {
      setError("Select a resume before asking AI to review it.");
      return;
    }

    setBusyMode("review");
    setReview(null);
    setMatch(null);
    setError(null);
    setNotice(null);

    try {
      const result = await postJson<{ review: ResumeReview }>("/api/ai/resume-review", {
        resume: primaryResume
      });
      setReview(result.review);
      setNotice(`Reviewed ${primaryResume.label}.`);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Resume review failed.");
    } finally {
      setBusyMode(null);
    }
  };

  const handleMatch = async () => {
    if (!hasMeaningfulJobInput(jobDraft)) {
      setMatch(null);
      setError("Paste or select a job before running AI match.");
      return;
    }

    if (selectedResumes.length === 0) {
      setError("Select at least one resume before running job match.");
      return;
    }

    setBusyMode("match");
    setMatch(null);
    setReview(null);
    setError(null);
    setNotice(null);

    try {
      const result = await postJson<{ match: JobMatch }>("/api/ai/job-match", {
        job: toJobPayload(jobDraft),
        resumes: selectedResumes
      });
      setMatch(result.match);
      setNotice(`Matched ${selectedResumes.length} resume${selectedResumes.length === 1 ? "" : "s"}.`);
    } catch (matchError) {
      setError(matchError instanceof Error ? matchError.message : "Job match failed.");
    } finally {
      setBusyMode(null);
    }
  };

  const copyCoverLetter = async () => {
    if (!match?.coverLetter) {
      return;
    }

    await navigator.clipboard.writeText(match.coverLetter);
    setNotice("Cover letter copied.");
  };

  return (
    <div className="page-stack">
      <section className="career-card career-ai-hero">
        <div className="card-header">
          <div>
            <p className="eyebrow">Career AI</p>
            <h2>Resume intelligence and job matching</h2>
            <p>
              Analyze builder or LaTeX resumes, match them against a job, generate a cover letter, and get a practical application plan.
            </p>
          </div>
          <Sparkles size={22} />
        </div>
        <div className="career-ai-status-row">
          <span className={aiStatus?.available ? "pill success" : "pill brand"}>
            {aiStatus?.available ? "Ready" : "Checking"}
          </span>
          <span className="career-ai-muted">{aiStatus?.message ?? "Checking career intelligence..."}</span>
        </div>
      </section>

      {error ? (
        <p className="settings-feedback error">
          <AlertTriangle size={14} /> {error}
        </p>
      ) : null}
      {notice ? <p className="settings-feedback success">{notice}</p> : null}

      <section className="career-ai-workspace">
        <div className="career-card career-ai-panel">
          <div className="card-header">
            <div>
              <p className="eyebrow">Job Entry</p>
              <h2>Paste or load a role</h2>
            </div>
            <Briefcase size={18} />
          </div>

          <label className="profile-field">
            Saved jobs
            <select disabled={availableJobs.length === 0} onChange={(event) => handleSavedJobChange(event.target.value)} value={selectedJobId}>
              <option value="">{availableJobs.length === 0 ? "No saved jobs yet" : "Manual job entry"}</option>
              {availableJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.company} / {job.role}
                </option>
              ))}
            </select>
          </label>

          <div className="career-ai-job-grid">
            <label className="profile-field">
              Role
              <input
                onChange={(event) => setJobDraft((current) => ({ ...current, role: event.target.value }))}
                placeholder="Frontend Engineer"
                value={jobDraft.role}
              />
            </label>
            <label className="profile-field">
              Company
              <input
                onChange={(event) => setJobDraft((current) => ({ ...current, company: event.target.value }))}
                placeholder="Acme"
                value={jobDraft.company}
              />
            </label>
          </div>

          <label className="profile-field">
            Location
            <input
              onChange={(event) => setJobDraft((current) => ({ ...current, location: event.target.value }))}
              placeholder="Remote, Bengaluru, New York..."
              value={jobDraft.location}
            />
          </label>

          <label className="profile-field">
            Keywords
            <input
              onChange={(event) => setJobDraft((current) => ({ ...current, tags: event.target.value }))}
              placeholder="React, TypeScript, AI tools"
              value={jobDraft.tags}
            />
          </label>

          <label className="profile-field">
            Job description
            <textarea
              className="career-ai-textarea"
              onChange={(event) => setJobDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="Paste the job description here..."
              value={jobDraft.description}
            />
          </label>
        </div>

        <div className="career-card career-ai-panel">
          <div className="card-header">
            <div>
              <p className="eyebrow">Resume List</p>
              <h2>Select candidates</h2>
            </div>
            <FileText size={18} />
          </div>

          <div className="career-ai-resume-actions">
            <button className="ghost-button" disabled={availableResumes.length === 0} onClick={() => setSelectedResumeIds(availableResumes.map((resume) => resume.id))} type="button">
              Select All
            </button>
            <button className="ghost-button" disabled={selectedResumeIds.length === 0} onClick={() => setSelectedResumeIds([])} type="button">
              Clear
            </button>
          </div>

          <div className="career-ai-resume-list">
            {availableResumes.length > 0 ? (
              availableResumes.map((resume) => {
                const selected = selectedResumeIds.includes(resume.id);

                return (
                  <button
                    className={selected ? "career-ai-resume-row selected" : "career-ai-resume-row"}
                    key={resume.id}
                    onClick={() => toggleResume(resume.id)}
                    type="button"
                  >
                    <span className="career-ai-check">{selected ? <CheckCircle2 size={15} /> : null}</span>
                    <span>
                      <strong>{resume.label}</strong>
                      <small>{resume.targetRoles.join(" / ") || "No target roles"}</small>
                      <small>
                        {resume.editorMode === "latex" ? "LaTeX" : "Visual"} / updated {compactDate(resume.updatedAt)}
                      </small>
                    </span>
                    <span className="pill">{resume.keywordCoverage || 0}%</span>
                  </button>
                );
              })
            ) : (
              <div className="career-ai-empty-upload">
                <p className="career-ai-muted">
                  {resumesLoading
                    ? "Loading saved resumes..."
                    : resumesError || "No saved resumes found. Upload or paste one to analyze it here."}
                </p>
                <div className="career-ai-upload-actions">
                  <label className="ghost-button career-ai-file-button">
                    {extractingResume ? <Loader2 className="spin" size={14} /> : <Upload size={14} />}
                    {extractingResume ? "Extracting" : "Upload Resume"}
                    <input
                      accept=".txt,.tex,.md,.markdown,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      disabled={extractingResume}
                      onChange={(event) => void handleResumeFileUpload(event)}
                      type="file"
                    />
                  </label>
                  {uploadedResumeFileName ? <span className="pill">{uploadedResumeFileName}</span> : null}
                </div>
                <label className="profile-field">
                  Resume label
                  <input
                    onChange={(event) => setUploadedResumeLabel(event.target.value)}
                    placeholder="Software Engineer Resume"
                    value={uploadedResumeLabel}
                  />
                </label>
                <label className="profile-field">
                  Resume text
                  <textarea
                    className="career-ai-upload-textarea"
                    onChange={(event) => setUploadedResumeText(event.target.value)}
                    placeholder="Extracted resume text appears here. You can edit it before adding."
                    value={uploadedResumeText}
                  />
                </label>
                <button className="primary-button" disabled={extractingResume || !uploadedResumeText.trim()} onClick={handleAddUploadedResume} type="button">
                  <FileText size={14} />
                  Add Resume
                </button>
              </div>
            )}
          </div>

          <div className="career-ai-actions">
            <button className="ghost-button" disabled={busyMode !== null || !primaryResume} onClick={() => void handleReview()} type="button">
              {busyMode === "review" ? <Loader2 className="spin" size={14} /> : <Target size={14} />}
              Review Resume
            </button>
            <button className="primary-button" disabled={!canAnalyzeMatch} onClick={() => void handleMatch()} type="button">
              {busyMode === "match" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              Analyze Match
            </button>
          </div>
        </div>
      </section>

      {busyMode === "match" ? (
        <AnalysisLoadingCard
          description="CareerOS is comparing the selected resumes against the job entry and preparing the cover letter."
          eyebrow="Analyzing Match"
          title="Finding the best resume fit"
        />
      ) : null}

      {busyMode !== "match" && match ? (
        <section className="career-card career-ai-results">
          <div className="career-ai-score-card">
            <span>{match.scoreOutOf10.toFixed(1)}</span>
            <small>/ 10</small>
            <strong>{match.bestResumeLabel}</strong>
            <p>{match.verdict}</p>
          </div>

          <div className="career-ai-result-grid">
            <div>
              <h3>Matched Evidence</h3>
              <ResultList items={match.matchedEvidence} />
            </div>
            <div>
              <h3>Gaps</h3>
              <ResultList items={match.gaps} />
            </div>
            <div>
              <h3>Resume Tweaks</h3>
              <ResultList items={match.resumeTweaks} />
            </div>
            <div>
              <h3>Application Strategy</h3>
              <ResultList items={match.applicationStrategy} />
            </div>
          </div>

          <div className="career-ai-cover-row">
            <div>
              <div className="card-header">
                <div>
                  <p className="eyebrow">Cover Letter</p>
                  <h2>Generated draft</h2>
                </div>
                <button className="ghost-button" onClick={() => void copyCoverLetter()} type="button">
                  <Copy size={13} />
                  Copy
                </button>
              </div>
              <pre>{match.coverLetter}</pre>
            </div>
            <div>
              <div className="card-header">
                <div>
                  <p className="eyebrow">Outreach</p>
                  <h2>Recruiter note</h2>
                </div>
                <Send size={16} />
              </div>
              <p>{match.outreachMessage}</p>
              <h3>Job Targets</h3>
              <ResultList items={match.recommendedJobTargets} />
            </div>
          </div>
        </section>
      ) : null}

      {busyMode === "review" ? (
        <AnalysisLoadingCard
          description="CareerOS is reading the selected resume and turning it into practical recruiter-facing feedback."
          eyebrow="Reviewing Resume"
          title="Analyzing resume readiness"
        />
      ) : null}

      {busyMode !== "review" && review ? (
        <section className="career-card career-ai-review-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Resume Review</p>
              <h2>{review.overallScore.toFixed(1)} / 10 market readiness</h2>
              <p>{review.marketPosition}</p>
            </div>
            <Target size={20} />
          </div>

          <div className="career-ai-result-grid">
            <div>
              <h3>Target Roles</h3>
              <ResultList items={review.targetRoles} />
            </div>
            <div>
              <h3>Strengths</h3>
              <ResultList items={review.strengths} />
            </div>
            <div>
              <h3>Improve</h3>
              <ResultList items={review.gaps} />
            </div>
            <div>
              <h3>ATS Keywords</h3>
              <ResultList items={review.atsKeywords} />
            </div>
          </div>

          <div className="career-ai-note-band">
            <strong>Recruiter summary</strong>
            <p>{review.recruiterSummary}</p>
            <strong>Visual and LaTeX notes</strong>
            <ResultList items={review.latexOrVisualNotes} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
