import type { ResumeTemplateId } from "@careeros/shared";
import { getResumeTemplateById } from "@/lib/resume-templates";

export function ResumeTemplatePreview({ templateId }: { templateId: ResumeTemplateId }) {
  const template = getResumeTemplateById(templateId);
  const sections = template.defaultSections.slice(0, 4);

  return (
    <div className="template-preview">
      <div className="template-preview-sheet">
        <header className="template-preview-head">
          <strong>{template.name}</strong>
          <span>{template.family}</span>
        </header>

        {sections.length === 0 ? (
          <div className="template-preview-empty">Blank A4 Canvas</div>
        ) : (
          <div className="template-preview-sections">
            {sections.map((section) => (
              <section className="template-preview-section" key={section.title}>
                <h4>{section.title}</h4>
                <p>{section.contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 70)}...</p>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
