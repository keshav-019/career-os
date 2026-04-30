import { Copy, Download, FileText, GitBranch, MoreHorizontal, Sparkles } from "lucide-react";
import { mockJobs, mockResumeVersions } from "@/lib/mock-data";

const templates = [
  { name: "Modern ATS", desc: "Recruiter-tested single column", tag: "ATS" },
  { name: "Executive", desc: "Achievement-led senior layout", tag: "Senior" },
  { name: "Editorial", desc: "Typography-forward for hybrid roles", tag: "Design" },
  { name: "Technical", desc: "Project-heavy engineering format", tag: "Builds" }
];

export default function ResumesPage() {
  return (
    <div className="page-stack">
      <section className="two-column-grid">
        <div className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Your Resumes</p>
              <h2>Version library</h2>
            </div>
            <span className="pill brand">{mockResumeVersions.length} active</span>
          </div>

          <div className="resume-list">
            {mockResumeVersions.map((resume) => {
              const mappedJobs = mockJobs.filter((job) => job.resumeVersionId === resume.id);

              return (
                <article className="resume-row" key={resume.id}>
                  <div className="resume-icon">
                    <FileText size={23} />
                    {resume.status === "active" ? <em>LIVE</em> : null}
                  </div>
                  <div>
                    <h3>{resume.label}</h3>
                    <p>
                      <GitBranch size={12} /> {mappedJobs.length} mapped jobs / updated recently
                    </p>
                    <div className="tag-cloud" style={{ marginTop: 10 }}>
                      {resume.targetRoles.slice(0, 3).map((role) => (
                        <span key={role}>{role}</span>
                      ))}
                    </div>
                  </div>
                  <div className="resume-actions">
                    <span className={resume.keywordCoverage >= 85 ? "score" : "score small"}>
                      {resume.keywordCoverage}
                    </span>
                    <button className="icon-button" aria-label={`Copy ${resume.label}`} type="button">
                      <Copy size={15} />
                    </button>
                    <button className="icon-button" aria-label={`Download ${resume.label}`} type="button">
                      <Download size={15} />
                    </button>
                    <button className="icon-button" aria-label={`More actions for ${resume.label}`} type="button">
                      <MoreHorizontal size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="career-card highlight">
          <div className="card-header">
            <div>
              <p className="eyebrow">AI Suggestions</p>
              <h2>Bullet upgrades</h2>
            </div>
            <Sparkles size={19} />
          </div>

          <div className="suggestion-list">
            {[
              {
                before: "Built internal tooling.",
                after: "Shipped a Firebase-backed workflow dashboard that reduced manual tracking work by 42%."
              },
              {
                before: "Worked on AI features.",
                after: "Integrated AI-assisted job matching with explainable scoring and resume keyword coverage."
              }
            ].map((suggestion) => (
              <div className="suggestion-row" key={suggestion.after}>
                <div>
                  <span>Before</span>
                  <p>{suggestion.before}</p>
                </div>
                <div>
                  <span>After</span>
                  <p>{suggestion.after}</p>
                </div>
                <button className="ghost-button" type="button">Apply</button>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Template Marketplace</p>
            <h2>Career-ready formats</h2>
          </div>
        </div>

        <div className="template-grid" style={{ marginTop: 14 }}>
          {templates.map((template) => (
            <article className="template-card" key={template.name}>
              <div className="template-preview" />
              <h3>{template.name}</h3>
              <p>{template.desc}</p>
              <span className="pill brand">{template.tag}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
