import { CalendarDays, CheckCircle2, Database, Download, Mail, PanelTop, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

const integrations = [
  {
    name: "Browser Extension",
    status: "Packaging ready",
    detail: "Capture jobs from LinkedIn, Indeed, Greenhouse, Lever, and direct listings.",
    icon: PanelTop
  },
  {
    name: "Gmail Parser",
    status: "Queued",
    detail: "Classify recruiter, interview, rejection, offer, and follow-up emails.",
    icon: Mail
  },
  {
    name: "Calendar Reminders",
    status: "Queued",
    detail: "Create prep blocks, follow-ups, interview holds, and deadline reminders.",
    icon: CalendarDays
  },
  {
    name: "Firebase",
    status: isFirebaseAdminConfigured ? "Configured" : "Env needed",
    detail: "Firestore, Auth, security rules, and server-side persistence.",
    icon: Database
  },
  {
    name: "Mobile App",
    status: "Planned",
    detail: "Expo notifications, quick status updates, and mobile prep cards.",
    icon: Smartphone
  }
];

export default function IntegrationsPage() {
  return (
    <div className="page-stack">
      <section className="career-card extension-hero-card">
        <div className="extension-hero-copy">
          <div className="integration-icon extension-hero-icon">
            <PanelTop size={24} />
          </div>
          <div>
            <p className="eyebrow">Browser Extension</p>
            <h2>CareerOS Capture</h2>
            <p>
              Save roles from supported job boards into your CareerOS pipeline from Chrome or Firefox.
            </p>
          </div>
        </div>
        <div className="extension-hero-actions">
          <button
            className="primary-button"
            disabled
            title="Chrome direct install requires a Chrome Web Store or enterprise deployment channel."
            type="button"
          >
            <Download size={15} />
            Chrome Install
          </button>
          <Link className="ghost-button" href="/api/extension/download?browser=firefox">
            <Download size={15} />
            Firefox XPI
          </Link>
          <Link className="ghost-button" href="/settings">
            <ShieldCheck size={15} />
            Connect Account
          </Link>
        </div>
      </section>

      <section className="extension-install-grid">
        {[
          {
            title: "Chrome",
            detail: "Direct installs are parked until the extension has a compliant Chrome install channel.",
            action: "Pending"
          },
          {
            title: "Firefox",
            detail: "The XPI package is generated for Firefox and ready for signing before public release.",
            action: "XPI ready"
          },
          {
            title: "Release",
            detail: "Both browser packages are produced from the same CareerOS Capture source.",
            action: "Shared build"
          }
        ].map((item) => (
          <article className="career-card extension-step-card" key={item.title}>
            <span>{item.action}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
            <CheckCircle2 size={15} />
          </article>
        ))}
      </section>

      <div className="integration-grid">
        {integrations.map((integration) => {
          const Icon = integration.icon;

          return (
            <article className="career-card integration-panel" key={integration.name}>
              <div className="integration-icon">
                <Icon size={21} />
              </div>
              <div>
                <h3>{integration.name}</h3>
                <p>{integration.detail}</p>
              </div>
              <span className={integration.status === "Configured" ? "pill success" : "pill brand"}>
                {integration.status}
              </span>
            </article>
          );
        })}
      </div>
    </div>
  );
}
