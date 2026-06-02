import { CheckCircle2, Download, Laptop, Sparkles } from "lucide-react";
import Link from "next/link";

type ResumeStudioDesktopOnlyCardProps = {
  eyebrow?: string;
  title?: string;
};

export function ResumeStudioDesktopOnlyCard({
  eyebrow = "Resume Studio",
  title = "Available exclusively on CareerOS Desktop"
}: ResumeStudioDesktopOnlyCardProps) {
  return (
    <div className="page-stack">
      <section className="career-card highlight desktop-exclusive-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <p>
              Resume creation, editing, versioning, compile, and export now run only in the Desktop app for faster performance
              and a more reliable workflow.
            </p>
          </div>
          <Laptop size={22} />
        </div>

        <div className="desktop-exclusive-actions">
          <Link className="primary-button" href="/desktop">
            <Download size={15} />
            Open Desktop Setup
          </Link>
          <Link className="ghost-button" href="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </section>

      <section className="career-card desktop-exclusive-benefits">
        <div className="card-header">
          <div>
            <p className="eyebrow">Why Desktop</p>
            <h2>Built for advanced resume workflows</h2>
          </div>
          <Sparkles size={18} />
        </div>

        <div className="topic-list">
          <div className="desktop-exclusive-row">
            <CheckCircle2 size={15} />
            <p>Full Resume Studio functionality is centralized in one desktop experience.</p>
          </div>
          <div className="desktop-exclusive-row">
            <CheckCircle2 size={15} />
            <p>Local processing gives better speed and stability for large multi-version resumes.</p>
          </div>
          <div className="desktop-exclusive-row">
            <CheckCircle2 size={15} />
            <p>Compile and export flows are optimized for desktop helper integration.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
