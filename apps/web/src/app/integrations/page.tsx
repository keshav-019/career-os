import { CalendarDays, Database, Mail, PanelTop, Smartphone } from "lucide-react";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

const integrations = [
  {
    name: "Chrome Extension",
    status: "Starter ready",
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
  );
}
