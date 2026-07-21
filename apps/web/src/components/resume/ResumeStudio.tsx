'use client';

import { Code2, LayoutTemplate } from 'lucide-react';
import { useState } from 'react';
import LatexMode from './LatexMode';
import VisualMode from './VisualMode';
import { ResumeData } from '@/lib/resume-types';

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
  certifications: []
};

export default function ResumeStudio() {
  const [activeMode, setActiveMode] = useState<'latex' | 'visual'>('visual');
  const [resumeData, setResumeData] = useState<ResumeData>(defaultResumeData);

  return (
    <div className="resume-studio-shell">
      <section className="career-card resume-studio-header-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Desktop Workspace</p>
            <h2>Resume Studio</h2>
            <p>
              {activeMode === 'latex'
                ? 'Write LaTeX, compile locally, inspect errors, and export the finished PDF.'
                : 'Build a structured resume visually and export it as a PDF.'}
            </p>
          </div>

          <div className="studio-tabs" role="tablist" aria-label="Resume editor mode">
            <button
              aria-selected={activeMode === 'visual'}
              className={activeMode === 'visual' ? 'studio-tab active' : 'studio-tab'}
              onClick={() => setActiveMode('visual')}
              role="tab"
              type="button"
            >
              <LayoutTemplate size={15} />
              Visual
            </button>
            <button
              aria-selected={activeMode === 'latex'}
              className={activeMode === 'latex' ? 'studio-tab active' : 'studio-tab'}
              onClick={() => setActiveMode('latex')}
              role="tab"
              type="button"
            >
              <Code2 size={15} />
              LaTeX
            </button>
          </div>
        </div>
      </section>

      <section className="resume-studio-content-card">
        {activeMode === 'latex' ? <LatexMode /> : <VisualMode data={resumeData} onChange={setResumeData} />}
      </section>
    </div>
  );
}

