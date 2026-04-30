import { AlarmClock, Briefcase, Video } from "lucide-react";

const events = [
  { day: 3, type: "interview", title: "OrbitWorks hiring manager", time: "7:30 PM / video", icon: Video },
  { day: 5, type: "prep", title: "Mock interview: AI workflows", time: "45 min prep", icon: Briefcase },
  { day: 9, type: "deadline", title: "NovaBank follow-up", time: "Send by noon", icon: AlarmClock },
  { day: 12, type: "interview", title: "LatticeOps recruiter call", time: "2:00 PM / phone", icon: Video }
];

const eventTone: Record<string, string> = {
  interview: "calendar-event",
  prep: "calendar-event success",
  deadline: "calendar-event danger"
};

export default function CalendarPage() {
  const days = Array.from({ length: 35 }, (_, index) => index - 1);

  return (
    <section className="two-column-grid">
      <div className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">June 2026</p>
            <h2>Career calendar</h2>
          </div>
          <span className="pill brand">Google sync planned</span>
        </div>
        <div className="calendar-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div className="calendar-label" key={day}>{day}</div>
          ))}
          {days.map((day, index) => {
            const inMonth = day > 0 && day <= 30;
            const event = events.find((item) => item.day === day);

            return (
              <div className={inMonth ? "calendar-day" : "calendar-day out"} key={index}>
                <strong>{inMonth ? day : ""}</strong>
                {event ? <span className={eventTone[event.type]}>{event.title}</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="page-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Upcoming</p>
            <h2>Scheduled missions</h2>
          </div>
        </div>
        {events.map((event) => {
          const Icon = event.icon;

          return (
            <article className="event-card" key={event.title}>
              <div className="calendar-day-tile">
                <span>Jun</span>
                <strong>{String(event.day).padStart(2, "0")}</strong>
              </div>
              <div>
                <h3>{event.title}</h3>
                <p>
                  <Icon size={12} /> {event.time}
                </p>
              </div>
            </article>
          );
        })}
      </aside>
    </section>
  );
}
