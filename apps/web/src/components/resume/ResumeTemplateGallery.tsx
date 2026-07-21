'use client';

import { Check } from 'lucide-react';
import { RESUME_VISUAL_TEMPLATES, type ResumeVisualTemplateId } from './templates';
import TemplateThumbnail from './TemplateThumbnail';

interface ResumeTemplateGalleryProps {
  selectedTemplateId: ResumeVisualTemplateId | null;
  onSelect: (templateId: ResumeVisualTemplateId) => void;
}

export default function ResumeTemplateGallery({ selectedTemplateId, onSelect }: ResumeTemplateGalleryProps) {
  return (
    <div className="resume-template-gallery">
      <div className="resume-template-gallery-intro">
        <p className="eyebrow">Choose a template</p>
        <h2>Pick a starting layout</h2>
        <p className="muted">
          Modeled on well-known resume archetypes. You can switch templates anytime without losing your details.
        </p>
      </div>

      <div className="resume-template-grid">
        {RESUME_VISUAL_TEMPLATES.map((template) => {
          const isSelected = selectedTemplateId === template.id;
          return (
            <button
              className={`resume-template-card${isSelected ? ' resume-template-card-active' : ''}`}
              key={template.id}
              onClick={() => onSelect(template.id)}
              type="button"
            >
              <TemplateThumbnail template={template} />
              <div className="resume-template-card-body">
                <div className="resume-template-card-title">
                  <span className="resume-template-card-title-text">
                    <span aria-hidden="true" className="resume-template-card-dot" style={{ background: template.accent }} />
                    {template.name}
                  </span>
                  {isSelected ? (
                    <span className="resume-template-card-check">
                      <Check size={12} />
                    </span>
                  ) : null}
                </div>
                <p className="resume-template-card-tagline">{template.tagline}</p>
                <p className="resume-template-card-description">{template.description}</p>
                <p className="resume-template-card-best-for">{template.bestFor}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
