'use client';

import { AlertTriangle, Download, LayoutTemplate, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import html2pdf from 'html2pdf.js';
import ResumeForm from './ResumeForm';
import ResumeTemplateGallery from './ResumeTemplateGallery';
import { DEFAULT_RESUME_TEMPLATE_ID, getResumeVisualTemplate, type ResumeVisualTemplateId } from './templates';
import { ResumeData } from '@/lib/resume-types';
import { useUserJobs, type CareerJob } from '@/lib/firebase/jobs';
import { hasMeaningfulProfileContent, loadStoredProfile } from '@/lib/profile-data';

const TEMPLATE_STORAGE_KEY = 'careeros:resume-studio:visual-template-id';
const A4_HEIGHT_TO_WIDTH_RATIO = 297 / 210;
const PAGE_BREAK_CLASS = 'resume-visual-page-break';

interface VisualModeProps {
  data: ResumeData;
  onChange: (data: ResumeData) => void;
}

function readStoredTemplateId(): ResumeVisualTemplateId | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
  return (stored as ResumeVisualTemplateId | null) ?? null;
}

function jobOptionLabel(job: CareerJob): string {
  const role = job.role || 'Untitled role';
  const company = job.company ? ` @ ${job.company}` : '';
  return `${role}${company}`;
}

function jobToGenerateResumePayload(job: CareerJob): Record<string, unknown> {
  return {
    company: job.company || '',
    jdText: job.jdText || job.responsibilitiesText || job.eligibilityText || job.aboutText || '',
    location: job.location || '',
    role: job.role || '',
    tags: job.tags || []
  };
}

/**
 * Measures the resume page's rendered content so the on-screen preview and the exported PDF stay
 * consistent: the page div itself is never clipped (no overflow:hidden, no fixed aspect-ratio), so
 * it grows to fit however much content is actually there instead of silently hiding overflow. This
 * hook just measures that natural height against one A4 page's pixel height (derived from the
 * page's own rendered width) so we know how many pages the content spans, and can draw page-break
 * markers at the right offsets - the same true height html2canvas/html2pdf will capture for export.
 */
function usePagePagination(pageRef: { current: HTMLDivElement | null }, deps: unknown[]) {
  const [pageHeightPx, setPageHeightPx] = useState(0);
  const [contentHeightPx, setContentHeightPx] = useState(0);

  useLayoutEffect(() => {
    const node = pageRef.current;
    if (!node) return undefined;

    const measure = () => {
      if (node.offsetWidth > 0) {
        setPageHeightPx(node.offsetWidth * A4_HEIGHT_TO_WIDTH_RATIO);
      }
      setContentHeightPx(node.scrollHeight);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const pageCount = pageHeightPx > 0 ? Math.max(1, Math.ceil(contentHeightPx / pageHeightPx)) : 1;

  return { pageCount, pageHeightPx };
}

export default function VisualMode({ data, onChange }: VisualModeProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<ResumeVisualTemplateId | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { jobs } = useUserJobs();
  const [selectedJobId, setSelectedJobId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTemplateId(readStoredTemplateId());
    setHydrated(true);
  }, []);

  const { pageCount, pageHeightPx } = usePagePagination(canvasRef, [data, selectedTemplateId]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);

  const handleGenerateForJob = useCallback(async () => {
    if (!selectedJob) {
      setGenerateError('Pick a job to tailor the resume for first.');
      return;
    }

    const profile = loadStoredProfile();
    if (!profile || !hasMeaningfulProfileContent(profile)) {
      setGenerateError(
        'We do not have enough detail about you yet to tailor a resume. Update your Profile (experience, projects, education) with some real detail, or fill in the fields below yourself.'
      );
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateNotice(null);

    try {
      const response = await fetch('/api/ai/generate-resume', {
        body: JSON.stringify({ job: jobToGenerateResumePayload(selectedJob), profile }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST'
      });

      const payload = (await response.json()) as { error?: string; ok?: boolean; resume?: ResumeData };

      if (!response.ok || !payload.ok || !payload.resume) {
        throw new Error(payload.error || 'Unable to generate a tailored resume.');
      }

      const generated = payload.resume;
      onChange({
        ...generated,
        personal: {
          ...generated.personal,
          github: data.personal.github,
          linkedin: data.personal.linkedin,
          portfolio: data.personal.portfolio
        }
      });
      setGenerateNotice(`Resume tailored for ${jobOptionLabel(selectedJob)}. Review it below, then download.`);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Unable to generate a tailored resume.');
    } finally {
      setIsGenerating(false);
    }
  }, [data.personal.github, data.personal.linkedin, data.personal.portfolio, onChange, selectedJob]);

  const handleSelectTemplate = useCallback((templateId: ResumeVisualTemplateId) => {
    setSelectedTemplateId(templateId);
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, templateId);
  }, []);

  const handleChangeTemplate = useCallback(() => {
    setSelectedTemplateId(null);
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    if (!canvasRef.current) {
      return;
    }

    setIsDownloading(true);
    try {
      const opt = {
        filename: `${data.personal.firstName || 'resume'}_${data.personal.lastName || ''}.pdf`,
        html2canvas: {
          scale: 2,
          useCORS: true,
          // The page-break markers are a preview-only aid (dashed dividers + "Page N" labels) - they
          // must never end up baked into the exported PDF image itself.
          ignoreElements: (element: Element) => element.classList.contains(PAGE_BREAK_CLASS)
        },
        image: { type: 'jpeg' as const, quality: 0.98 },
        jsPDF: { unit: 'in' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'] as const },
        margin: 0
      };

      await html2pdf().set(opt).from(canvasRef.current).save();
    } catch (err) {
      console.error('PDF download failed', err);
    } finally {
      setIsDownloading(false);
    }
  }, [data]);

  if (!hydrated) {
    return null;
  }

  if (!selectedTemplateId) {
    return (
      <div className="career-card resume-template-gallery-pane">
        <ResumeTemplateGallery onSelect={handleSelectTemplate} selectedTemplateId={selectedTemplateId} />
      </div>
    );
  }

  const template = getResumeVisualTemplate(selectedTemplateId ?? DEFAULT_RESUME_TEMPLATE_ID);
  const TemplateComponent = template.component;

  return (
    <div className="resume-visual-layout">
      <article className="career-card resume-visual-form-pane">
        <div className="resume-visual-template-banner">
          <span>
            Template: <strong>{template.name}</strong>
          </span>
          <button className="ghost-button" onClick={handleChangeTemplate} type="button">
            <LayoutTemplate size={13} />
            Change template
          </button>
        </div>
        <section className="resume-ats-generator">
          <div className="card-header">
            <div>
              <p className="eyebrow">Career AI</p>
              <h2>Tailor this resume for a job</h2>
              <p>Regenerates the summary, experience, projects, and skills below to match a saved job. Nothing is saved until you download.</p>
            </div>
            <Sparkles size={18} />
          </div>

          <label className="profile-field">
            Saved jobs
            <select
              disabled={isGenerating}
              onChange={(event) => {
                setSelectedJobId(event.target.value);
                setGenerateError(null);
                setGenerateNotice(null);
              }}
              value={selectedJobId}
            >
              <option value="">{jobs.length === 0 ? 'No saved jobs yet' : 'Select a job...'}</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {jobOptionLabel(job)}
                </option>
              ))}
            </select>
          </label>

          <div className="career-ai-actions">
            <button
              className="primary-button"
              disabled={isGenerating || !selectedJobId}
              onClick={handleGenerateForJob}
              type="button"
            >
              {isGenerating ? <Loader2 className="spin-icon" size={15} /> : <Sparkles size={15} />}
              {isGenerating ? 'Generating' : 'Generate resume'}
            </button>
          </div>

          {generateError ? (
            <p className="settings-feedback error">
              <AlertTriangle size={14} /> {generateError}
            </p>
          ) : null}
          {generateNotice ? <p className="settings-feedback success">{generateNotice}</p> : null}
        </section>

        <ResumeForm data={data} onChange={onChange} />
        <div className="resume-visual-actions">
          <button className="primary-button" disabled={isDownloading} onClick={handleDownloadPDF} type="button">
            {isDownloading ? <Loader2 className="spin-icon" size={15} /> : <Download size={15} />}
            {isDownloading ? 'Generating' : 'Download PDF'}
          </button>
        </div>
      </article>

      <article className="career-card resume-visual-preview-pane">
        <div className="resume-visual-preview-meta">
          <span className="resume-visual-page-count">{pageCount > 1 ? `${pageCount} pages` : '1 page'}</span>
        </div>
        <div className="resume-visual-page" ref={canvasRef} style={pageHeightPx ? { minHeight: pageHeightPx } : undefined}>
          <TemplateComponent data={data} />
          {Array.from({ length: pageCount - 1 }, (_, index) => (
            <div
              className={PAGE_BREAK_CLASS}
              key={index}
              style={{ top: pageHeightPx * (index + 1) }}
            >
              <span>Page {index + 2}</span>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
