'use client';

import { Code2, FilePlus, LayoutTemplate, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import LatexMode from './LatexMode';
import VisualMode from './VisualMode';
import { DEFAULT_RESUME_TEMPLATE_ID, RESUME_VISUAL_TEMPLATES, type ResumeVisualTemplateId } from './templates';
import { ResumeData, VisualResumeRecord } from '@/lib/resume-types';
import { auth } from '@/lib/firebase/client';
import { useUserResumes, removeResumeRecord, type CareerResume } from '@/lib/firebase/resumes';
import { deleteVisualResume, saveVisualResume, useUserVisualResumes } from '@/lib/firebase/visual-resumes';

const defaultResumeData: ResumeData = {
  personal: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    portfolio: '',
    summary: ''
  },
  education: [],
  experience: [],
  skills: [],
  projects: [],
  certifications: [],
  skillsColumns: 2
};

type Mode = 'gallery' | 'visual' | 'latex';

type GalleryItem = {
  key: string;
  label: string;
  updatedAt: string;
  originLabel: string;
  jobLabel?: string;
  detail: string;
  onEdit?: () => void;
  onDelete: () => void;
};

/**
 * Resume Gallery + editors. Two independent storage systems feed the gallery: `mobileResumes` (Visual Mode,
 * structured ResumeData - shared with the phone app, see lib/firebase/visual-resumes.ts) and `resumes` (LaTeX
 * source + compiled PDF, and mobile-uploaded PDF/DOCX files - see lib/firebase/resumes.ts). Only Visual Mode
 * resumes are editable here: LaTeX resumes point back to CareerOS Desktop (the only place that can compile LaTeX
 * locally - see LatexMode.tsx), and uploaded files have no structured data to load back into an editor.
 */
export default function ResumeStudio() {
  const [mode, setMode] = useState<Mode>('gallery');
  const [activeVisualId, setActiveVisualId] = useState<string | null>(null);
  const [initialTemplateId, setInitialTemplateId] = useState<ResumeVisualTemplateId | undefined>(undefined);
  const [label, setLabel] = useState('Untitled resume');
  const [resumeData, setResumeData] = useState<ResumeData>(defaultResumeData);
  const [createdAt, setCreatedAt] = useState<string | undefined>(undefined);
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const [jobLabel, setJobLabel] = useState<string | undefined>(undefined);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const { resumes: legacyResumes, loading: legacyLoading } = useUserResumes();
  const { resumes: visualResumes, loading: visualLoading } = useUserVisualResumes();

  function startNewVisual() {
    setActiveVisualId(null);
    setInitialTemplateId(undefined);
    setLabel('Untitled resume');
    setResumeData(defaultResumeData);
    setCreatedAt(undefined);
    setJobId(undefined);
    setJobLabel(undefined);
    setSaveError(null);
    setSaveNotice(null);
    setMode('visual');
  }

  function openVisual(resume: VisualResumeRecord) {
    setActiveVisualId(resume.id);
    setInitialTemplateId((resume.templateId as ResumeVisualTemplateId) || DEFAULT_RESUME_TEMPLATE_ID);
    setLabel(resume.label);
    setResumeData(resume.data);
    setCreatedAt(resume.createdAt);
    setJobId(resume.jobId);
    setJobLabel(resume.jobLabel);
    setSaveError(null);
    setSaveNotice(null);
    setMode('visual');
  }

  async function handleSaveVisual() {
    const userId = auth?.currentUser?.uid;
    if (!userId) {
      setSaveError('Sign in to save resumes.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const id = activeVisualId ?? `resume-${Date.now()}`;
      await saveVisualResume(
        userId,
        id,
        label.trim() || 'Untitled resume',
        initialTemplateId ?? DEFAULT_RESUME_TEMPLATE_ID,
        resumeData,
        createdAt,
        jobId,
        jobLabel
      );
      setActiveVisualId(id);
      setSaveNotice('Saved to your Resume Gallery.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this resume.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVisual(resume: VisualResumeRecord) {
    const userId = auth?.currentUser?.uid;
    if (!userId || !window.confirm(`Delete "${resume.label}"? This can't be undone.`)) return;
    await deleteVisualResume(userId, resume.id);
  }

  async function handleDeleteLegacy(resume: CareerResume) {
    const userId = auth?.currentUser?.uid;
    if (!userId || !window.confirm(`Delete "${resume.label}"? This can't be undone.`)) return;
    await removeResumeRecord(userId, resume.id);
  }

  const galleryItems = useMemo<GalleryItem[]>(() => {
    const visualItems: GalleryItem[] = visualResumes.map((resume) => {
      const templateName = RESUME_VISUAL_TEMPLATES.find((t) => t.id === resume.templateId)?.name ?? resume.templateId;
      return {
        key: `visual-${resume.id}`,
        label: resume.label,
        updatedAt: resume.updatedAt,
        originLabel: 'Visual',
        jobLabel: resume.jobLabel,
        detail: `${templateName} - updated ${new Date(resume.updatedAt).toLocaleDateString()}`,
        onEdit: () => openVisual(resume),
        onDelete: () => void handleDeleteVisual(resume)
      };
    });

    const legacyItems: GalleryItem[] = legacyResumes.map((resume) => ({
      key: `legacy-${resume.id}`,
      label: resume.label,
      updatedAt: resume.updatedAt,
      originLabel: resume.editorMode === 'latex' ? 'LaTeX' : 'Uploaded',
      detail:
        resume.editorMode === 'latex'
          ? `LaTeX - updated ${new Date(resume.updatedAt).toLocaleDateString()}`
          : `Uploaded file - updated ${new Date(resume.updatedAt).toLocaleDateString()}`,
      onDelete: () => void handleDeleteLegacy(resume)
    }));

    return [...visualItems, ...legacyItems].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualResumes, legacyResumes]);

  if (mode === 'gallery') {
    return (
      <div className="resume-studio-shell">
        <section className="career-card resume-studio-header-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Resume Gallery</p>
              <h2>Your saved resumes</h2>
              <p>Every version you have generated or uploaded, kept side by side so you never lose one.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="ghost-button" onClick={() => setMode('latex')} type="button">
                <Code2 size={15} />
                LaTeX (Desktop)
              </button>
              <button className="primary-button" onClick={startNewVisual} type="button">
                <FilePlus size={15} />
                New Visual Resume
              </button>
            </div>
          </div>
        </section>

        <section className="career-card">
          {legacyLoading || visualLoading ? <p>Loading your resumes...</p> : null}
          {!legacyLoading && !visualLoading && galleryItems.length === 0 ? (
            <p className="resume-form-empty">
              No resumes yet. Build one with Visual Mode, upload one from the phone app, or (on CareerOS Desktop) write one in LaTeX.
            </p>
          ) : null}
          {galleryItems.map((item) => (
            <div key={item.key} className="admin-coding-list-item" style={{ cursor: item.onEdit ? 'pointer' : 'default' }}>
              <div onClick={item.onEdit} style={{ flex: 1 }}>
                <strong>
                  {item.label} <span className="pill">{item.originLabel}</span>
                </strong>
                <span>{item.detail}</span>
                {item.jobLabel ? <span style={{ display: 'block', fontWeight: 600 }}>Tailored for: {item.jobLabel}</span> : null}
                {!item.onEdit ? (
                  <span style={{ display: 'block', fontStyle: 'italic' }}>
                    {item.originLabel === 'LaTeX' ? 'Edit this on CareerOS Desktop.' : 'Uploaded files are not editable here.'}
                  </span>
                ) : null}
              </div>
              <button className="ghost-button danger-button" onClick={item.onDelete} type="button" aria-label="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (mode === 'visual') {
    return (
      <div className="resume-studio-shell">
        <section className="career-card resume-studio-header-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Visual Mode</p>
              <h2>Edit resume</h2>
              <p>{jobLabel ? `Tailored for: ${jobLabel}` : 'Build a structured resume visually and export it as a PDF.'}</p>
            </div>
            <button className="ghost-button" onClick={() => setMode('gallery')} type="button">
              <LayoutTemplate size={15} />
              Back to gallery
            </button>
          </div>
          <input
            className="resume-label-input"
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Resume label"
            style={{ marginTop: 12, padding: 10, width: '100%', maxWidth: 360 }}
            value={label}
          />
        </section>

        <section className="resume-studio-content-card">
          <VisualMode
            key={activeVisualId ?? 'new'}
            data={resumeData}
            initialTemplateId={initialTemplateId}
            onChange={setResumeData}
            onGeneratedForJob={(id, generatedJobLabel) => {
              setJobId(id);
              setJobLabel(generatedJobLabel);
            }}
          />
        </section>

        <section className="career-card" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="primary-button" disabled={saving} onClick={() => void handleSaveVisual()} type="button">
            {saving ? 'Saving...' : 'Save to Gallery'}
          </button>
          {saveError ? <span style={{ color: 'var(--danger, #c0392b)' }}>{saveError}</span> : null}
          {saveNotice ? <span style={{ color: 'var(--success, #1f9d73)' }}>{saveNotice}</span> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="resume-studio-shell">
      <section className="career-card resume-studio-header-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">LaTeX Mode</p>
            <h2>Write LaTeX, compile, and export</h2>
            <p>Local compilation requires CareerOS Desktop - this mode is view/edit only until you install it.</p>
          </div>
          <button className="ghost-button" onClick={() => setMode('gallery')} type="button">
            <LayoutTemplate size={15} />
            Back to gallery
          </button>
        </div>
      </section>
      <section className="resume-studio-content-card">
        <LatexMode />
      </section>
    </div>
  );
}
