import { Bell, Lock, UserRound } from "lucide-react";

const settings = [
  {
    title: "Profile",
    icon: UserRound,
    rows: ["Target role: Software Engineer", "Location preference: Remote / hybrid", "Portfolio mode: Enabled"]
  },
  {
    title: "Notifications",
    icon: Bell,
    rows: ["Interview reminders", "Follow-up reminders", "Daily career digest"]
  },
  {
    title: "Privacy",
    icon: Lock,
    rows: ["Private by default", "User-scoped Firestore rules", "Local mock data enabled"]
  }
];

export default function SettingsPage() {
  return (
    <div className="settings-grid">
      {settings.map((group) => {
        const Icon = group.icon;

        return (
          <article className="settings-card" key={group.title}>
            <div className="card-header">
              <div>
                <p className="eyebrow">Settings</p>
                <h2>{group.title}</h2>
              </div>
              <Icon size={19} />
            </div>
            <div className="settings-list">
              {group.rows.map((row) => (
                <div className="settings-row" key={row}>
                  <span className="pill success">On</span>
                  <p>{row}</p>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
