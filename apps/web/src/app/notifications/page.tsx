import { AlarmClock, Briefcase, GraduationCap, MailCheck } from "lucide-react";

const notifications = [
  {
    icon: Briefcase,
    title: "OrbitWorks moved to hiring manager round",
    time: "2m ago",
    body: "Prep notes and resume mapping are ready for review.",
    tone: "brand",
    unread: true
  },
  {
    icon: AlarmClock,
    title: "Follow up with NovaBank today",
    time: "10m ago",
    body: "The application has been quiet for seven days.",
    tone: "warning",
    unread: true
  },
  {
    icon: GraduationCap,
    title: "Learning block generated",
    time: "1h ago",
    body: "A 45-minute AI evaluation drill was added to your prep queue.",
    tone: "success",
    unread: true
  },
  {
    icon: MailCheck,
    title: "Recruiter reply classified",
    time: "Yesterday",
    body: "CareerOS detected an interview signal from your inbox.",
    tone: "muted",
    unread: false
  }
];

export default function NotificationsPage() {
  return (
    <div className="notification-list">
      {notifications.map((notification) => {
        const Icon = notification.icon;

        return (
          <article className={notification.unread ? "notification-card unread" : "notification-card"} key={notification.title}>
            <div className={`notification-icon tone-${notification.tone}`}>
              <Icon size={18} />
            </div>
            <div>
              <div className="row-between">
                <h3>{notification.title}</h3>
                <span className="card-id">{notification.time}</span>
              </div>
              <p>{notification.body}</p>
            </div>
            {notification.unread ? <span className="unread-dot" /> : null}
          </article>
        );
      })}
    </div>
  );
}
