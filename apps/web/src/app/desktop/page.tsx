import { CheckCircle2, Download, Laptop } from "lucide-react";
import Link from "next/link";

const DESKTOP_HELPER_ENDPOINT = "http://127.0.0.1:43823";

export default function DesktopSetupPage() {
  return (
    <div className="page-stack">
      <section className="career-card highlight">
        <div className="card-header">
          <div>
            <p className="eyebrow">CareerOS Desktop</p>
            <h2>Enable desktop-only features</h2>
            <p>
              Resume Studio compile and advanced PDF generation are powered by the CareerOS Desktop app running on your machine.
            </p>
          </div>
          <Laptop size={22} />
        </div>
        <div className="row-between" style={{ marginTop: 12 }}>
          <span className="pill success">Desktop helper endpoint: {DESKTOP_HELPER_ENDPOINT}</span>
          <a
            className="primary-button"
            href="#"
            onClick={(event) => event.preventDefault()}
            title="Desktop installer packaging is ready in apps/desktop. Publish your installer URL here."
          >
            <Download size={14} /> Download Desktop App
          </a>
        </div>
      </section>

      <section className="career-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Setup</p>
            <h2>How to get running</h2>
          </div>
        </div>
        <ol className="topic-list" style={{ margin: 0 }}>
          <li>
            <strong>Install CareerOS Desktop.</strong>
            <p>Build and distribute installer from `apps/desktop` (DMG/EXE).</p>
          </li>
          <li>
            <strong>Install local TeX runtime.</strong>
            <p>Use MacTeX / TeX Live / MiKTeX so desktop app can run `pdflatex`.</p>
          </li>
          <li>
            <strong>Keep Desktop app open.</strong>
            <p>Resume Studio checks `{DESKTOP_HELPER_ENDPOINT}/health` before compile.</p>
          </li>
          <li>
            <strong>Compile from Resume Studio.</strong>
            <p>In LaTeX mode, click `Check Desktop` and then `Compile (Desktop)`.</p>
          </li>
        </ol>
      </section>

      <section className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Developer Notes</p>
            <h2>Monorepo commands</h2>
          </div>
          <CheckCircle2 size={18} />
        </div>
        <div className="topic-list">
          <p>
            <code>npm run dev --workspace @careeros/desktop</code> starts Electron + local compile API.
          </p>
          <p>
            <code>npm run dist --workspace @careeros/desktop</code> builds installer artifacts under `apps/desktop/dist`.
          </p>
          <p>
            Optional web env override: <code>NEXT_PUBLIC_DESKTOP_HELPER_URL</code>.
          </p>
        </div>
        <div style={{ marginTop: 12 }}>
          <Link className="ghost-button" href="/resumes">
            Back to Resume Studio
          </Link>
        </div>
      </section>
    </div>
  );
}
