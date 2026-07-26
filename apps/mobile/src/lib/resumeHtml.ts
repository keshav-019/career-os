import type { ResumeData, ResumeTemplateId } from "../types/resume";
import { RESUME_VISUAL_TEMPLATES } from "../types/resume";

/** Builds a printable HTML string for expo-print (Print.printToFileAsync({ html })) - the mobile equivalent of
 *  the web Visual Mode's html2pdf.js rasterization, since that browser-only library has no RN port. Layout
 *  mirrors ResumePreview.tsx's native render closely enough to look like the same document. */
export function buildResumeHtml(data: ResumeData, templateId: ResumeTemplateId): string {
  const accent = RESUME_VISUAL_TEMPLATES.find((t) => t.id === templateId)?.accent ?? "#c1652f";
  const isSidebar = templateId === "sidebar";
  const isMono = templateId === "modern-writer";
  const font = isMono ? "'Courier New', monospace" : "'Helvetica Neue', Arial, sans-serif";

  const contact = [data.personal.email, data.personal.phone, data.personal.location, data.personal.linkedin, data.personal.github, data.personal.portfolio]
    .filter(Boolean)
    .join(" &nbsp;|&nbsp; ");

  function sectionTitle(text: string): string {
    if (templateId === "coral") {
      return `<div style="display:inline-block;background:${accent};color:#fff;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:6px;">${text}</div>`;
    }
    if (templateId === "spearmint") {
      return `<div style="border-bottom:2px solid ${accent};padding-bottom:3px;margin-bottom:6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${text}</div>`;
    }
    if (isMono) {
      return `<div style="font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:6px;">// ${text.toUpperCase()}</div>`;
    }
    return `<div style="color:${accent};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${text}</div>`;
  }

  const experienceHtml = data.experience
    .map(
      (exp) => `
        <div style="margin-bottom:10px;">
          <div style="font-size:12.5px;font-weight:700;">${exp.position} - ${exp.company}</div>
          <div style="font-size:10.5px;color:#666;">${exp.location} | ${exp.startDate} - ${exp.current ? "Present" : exp.endDate}</div>
          <ul style="margin:4px 0 0 16px;padding:0;font-size:11px;color:#333;">
            ${exp.description.map((bullet) => `<li>${bullet}</li>`).join("")}
          </ul>
        </div>`
    )
    .join("");

  const projectsHtml = data.projects
    .map(
      (project) => `
        <div style="margin-bottom:10px;">
          <div style="font-size:12.5px;font-weight:700;">${project.name}</div>
          ${project.technologies.length ? `<div style="font-size:10.5px;color:#666;">${project.technologies.join(", ")}</div>` : ""}
          <div style="font-size:11px;color:#333;">${project.description}</div>
        </div>`
    )
    .join("");

  const educationHtml = data.education
    .map(
      (edu) => `
        <div style="margin-bottom:8px;">
          <div style="font-size:12.5px;font-weight:700;">${edu.degree}${edu.field ? ` in ${edu.field}` : ""}</div>
          <div style="font-size:10.5px;color:#666;">${edu.institution} | ${edu.startDate} - ${edu.endDate}${edu.gpa ? ` | ${edu.gpa}` : ""}</div>
        </div>`
    )
    .join("");

  const certificationsHtml = data.certifications
    .map((cert) => `<div style="font-size:11px;color:#333;">${cert.name} - ${cert.issuer} (${cert.date})</div>`)
    .join("");

  // A skill group with no category renders as a plain bullet list with no bold heading ("just a bunch of
  // skills"). Groups flow into skillsColumns (1-3) via real CSS multi-column layout - sidebar's narrow rail
  // forces a single column regardless of the saved setting, same as the on-screen RN preview.
  const skillsColumnCount = isSidebar ? 1 : data.skillsColumns ?? 2;
  const skillsHtml = `<div style="column-count:${skillsColumnCount};column-gap:16px;">${data.skills
    .map((skill) =>
      skill.category
        ? `<div style="font-size:11px;color:#333;margin-bottom:4px;break-inside:avoid;"><b>${skill.category}:</b> ${skill.items.join(", ")}</div>`
        : skill.items
            .map((item) => `<div style="font-size:11px;color:#333;margin-bottom:2px;break-inside:avoid;">- ${item}</div>`)
            .join("")
    )
    .join("")}</div>`;

  const bodySections = `
    ${data.personal.summary ? `<div style="margin-bottom:14px;">${sectionTitle("Summary")}<div style="font-size:12px;color:#222;line-height:1.5;">${data.personal.summary}</div></div>` : ""}
    ${data.experience.length ? `<div style="margin-bottom:14px;">${sectionTitle("Experience")}${experienceHtml}</div>` : ""}
    ${data.projects.length ? `<div style="margin-bottom:14px;">${sectionTitle("Projects")}${projectsHtml}</div>` : ""}
    ${data.education.length ? `<div style="margin-bottom:14px;">${sectionTitle("Education")}${educationHtml}</div>` : ""}
    ${data.certifications.length ? `<div style="margin-bottom:14px;">${sectionTitle("Certifications")}${certificationsHtml}</div>` : ""}
  `;

  const skillsSection = data.skills.length ? `<div style="margin-bottom:14px;">${sectionTitle("Skills")}${skillsHtml}</div>` : "";

  const nameColor = isMono ? "#1c1c1c" : accent;
  const headerAlign = templateId === "swiss" ? "center" : "left";

  const layout = isSidebar
    ? `
      <div style="display:flex;gap:20px;">
        <div style="width:34%;border-right:1px solid #eee;padding-right:16px;">
          <div style="color:${accent};font-size:22px;font-weight:900;">${data.personal.firstName} ${data.personal.lastName}</div>
          <div style="font-size:12px;color:#555;margin-bottom:6px;">${data.personal.title ?? ""}</div>
          <div style="font-size:11px;color:#555;margin-bottom:12px;">${contact}</div>
          ${skillsSection}
        </div>
        <div style="flex:1;">${bodySections}</div>
      </div>`
    : `
      <div style="text-align:${headerAlign};margin-bottom:16px;">
        <div style="color:${nameColor};font-size:24px;font-weight:900;">${data.personal.firstName} ${data.personal.lastName}</div>
        <div style="font-size:12px;color:#555;">${data.personal.title ?? ""}</div>
        <div style="font-size:11px;color:#555;">${contact}</div>
      </div>
      ${bodySections}
      ${skillsSection}`;

  return `
    <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family:${font};padding:32px;color:#111;">
        ${layout}
      </body>
    </html>`;
}
