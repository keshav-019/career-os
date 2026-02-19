"use client";

import { AlarmClock, ChevronLeft, ChevronRight, PlusCircle, Trash2, Video } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CALENDAR_SYNC_CHANGE_EVENT, readCalendarSyncEnabled } from "@/lib/preferences";
import { useUserJobs } from "@/lib/firebase/jobs";
import {
  createReminder,
  removeReminder,
  useUserReminders,
  type CalendarReminder,
  type ReminderEventType
} from "@/lib/firebase/reminders";

type EventType = ReminderEventType;

type CalendarEvent = {
  id: string;
  notes: string;
  origin: "job" | "reminder";
  startsAt: string;
  title: string;
  type: EventType;
};

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const eventClassByType: Record<EventType, string> = {
  interview: "calendar-event",
  prep: "calendar-event success",
  deadline: "calendar-event danger",
  focus: "calendar-event warning"
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonthGrid(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const grid: { dayKey: string; dayNumber: number; inCurrentMonth: boolean }[] = [];

  for (let index = firstWeekday - 1; index >= 0; index -= 1) {
    const day = daysInPrevMonth - index;
    const date = new Date(year, month - 1, day);
    grid.push({ dayKey: toDateKey(date), dayNumber: day, inCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    grid.push({ dayKey: toDateKey(date), dayNumber: day, inCurrentMonth: true });
  }

  let nextMonthDay = 1;
  while (grid.length < 42) {
    const date = new Date(year, month + 1, nextMonthDay);
    grid.push({ dayKey: toDateKey(date), dayNumber: nextMonthDay, inCurrentMonth: false });
    nextMonthDay += 1;
  }

  return grid;
}

function buildEventsFromReminders(reminders: CalendarReminder[]): CalendarEvent[] {
  return reminders.map((reminder) => ({
    id: reminder.id,
    notes: reminder.notes,
    origin: "reminder",
    startsAt: reminder.startsAt,
    title: reminder.title,
    type: reminder.type
  }));
}

export default function CalendarPage() {
  const { error: jobsError, jobs } = useUserJobs();
  const { error: remindersError, reminders, user } = useUserReminders();

  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [viewDate, setViewDate] = useState<Date | null>(null);

  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [eventType, setEventType] = useState<EventType>("focus");
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let animationFrameId: number | null = null;
    animationFrameId = window.requestAnimationFrame(() => {
      setCalendarSyncEnabled(readCalendarSyncEnabled());
    });

    const handleSyncPreferenceChange = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      setCalendarSyncEnabled(Boolean(detail));
    };

    window.addEventListener(CALENDAR_SYNC_CHANGE_EVENT, handleSyncPreferenceChange as EventListener);
    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener(CALENDAR_SYNC_CHANGE_EVENT, handleSyncPreferenceChange as EventListener);
    };
  }, []);

  useEffect(() => {
    let animationFrameId: number | null = null;
    animationFrameId = window.requestAnimationFrame(() => {
      const today = new Date();
      setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    });

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  const allEvents = useMemo(() => {
    const reminderEvents = buildEventsFromReminders(reminders);
    const jobEvents: CalendarEvent[] = jobs
      .filter((job) => Boolean(job.nextActionAt))
      .map((job) => ({
        id: `job-${job.id}`,
        notes: `${job.company} / ${job.status}`,
        origin: "job",
        startsAt: job.nextActionAt ?? "",
        title: `${job.company}: ${job.role}`,
        type: job.status === "interviewing" ? "interview" : job.status === "applied" ? "deadline" : "focus"
      }));

    return [...reminderEvents, ...jobEvents]
      .filter((event) => Number.isFinite(Date.parse(event.startsAt)))
      .sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt));
  }, [jobs, reminders]);

  const eventsByDay = useMemo(() => {
    const mapping = new Map<string, CalendarEvent[]>();

    allEvents.forEach((event) => {
      const key = toDateKey(new Date(event.startsAt));
      const dayEvents = mapping.get(key) ?? [];
      dayEvents.push(event);
      mapping.set(key, dayEvents);
    });

    return mapping;
  }, [allEvents]);

  const monthGrid = useMemo(() => (viewDate ? buildMonthGrid(viewDate) : []), [viewDate]);
  const monthTitle = useMemo(
    () => (viewDate ? viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "Loading..."),
    [viewDate]
  );

  const upcomingEvents = useMemo(() => allEvents.slice(0, 8), [allEvents]);

  const handleAddEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setActionNotice(null);

    if (!title.trim() || !startsAt) {
      setActionError("Please enter title and date-time for the event.");
      return;
    }

    if (!user) {
      setActionError("Please sign in to create calendar events.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createReminder(user.uid, {
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        type: eventType,
        notes: notes.trim()
      });

      setTitle("");
      setStartsAt("");
      setEventType("focus");
      setNotes("");
      setActionNotice("Event added to your CareerOS calendar.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to add event.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventItem: CalendarEvent) => {
    if (!user) {
      setActionError("Please sign in to manage calendar events.");
      return;
    }

    if (eventItem.origin !== "reminder") {
      setActionError("Job-derived events cannot be deleted directly.");
      return;
    }

    setActionError(null);
    setActionNotice(null);
    setBusyEventId(eventItem.id);
    try {
      await removeReminder(user.uid, eventItem.id);
      setActionNotice("Event removed from your calendar.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete event.");
    } finally {
      setBusyEventId(null);
    }
  };

  return (
    <section className="two-column-grid">
      <div className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Calendar</p>
            <h2>CareerOS private calendar</h2>
            <p>Track interviews, prep, and deadlines directly in CareerOS with real account data.</p>
          </div>
          <span className={calendarSyncEnabled ? "pill success" : "pill"}>
            {calendarSyncEnabled ? "Google sync enabled" : "Google sync optional"}
          </span>
        </div>

        {jobsError ? <p className="settings-feedback error">{jobsError}</p> : null}
        {remindersError ? <p className="settings-feedback error">{remindersError}</p> : null}

        <div className="calendar-toolbar">
          <button
            aria-label="Previous month"
            className="icon-button"
            disabled={!viewDate}
            onClick={() =>
              setViewDate((current) =>
                current ? new Date(current.getFullYear(), current.getMonth() - 1, 1) : current
              )
            }
            type="button"
          >
            <ChevronLeft size={16} />
          </button>
          <strong>{monthTitle}</strong>
          <button
            aria-label="Next month"
            className="icon-button"
            disabled={!viewDate}
            onClick={() =>
              setViewDate((current) =>
                current ? new Date(current.getFullYear(), current.getMonth() + 1, 1) : current
              )
            }
            type="button"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="calendar-grid">
          {weekdayLabels.map((label) => (
            <div className="calendar-label" key={label}>
              {label}
            </div>
          ))}

          {monthGrid.map((day) => {
            const dayEvents = eventsByDay.get(day.dayKey) ?? [];

            return (
              <div className={day.inCurrentMonth ? "calendar-day" : "calendar-day out"} key={day.dayKey}>
                <strong>{day.dayNumber}</strong>
                {dayEvents.slice(0, 2).map((eventItem) => (
                  <span className={eventClassByType[eventItem.type]} key={eventItem.id}>
                    {eventItem.title}
                  </span>
                ))}
                {dayEvents.length > 2 ? <span className="calendar-more">+{dayEvents.length - 2} more</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="page-stack">
        <div className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Add Event</p>
              <h2>Schedule a new item</h2>
            </div>
            <PlusCircle size={18} />
          </div>

          <form className="calendar-form" onSubmit={handleAddEvent}>
            <label className="profile-field">
              Title
              <input
                onChange={(inputEvent) => setTitle(inputEvent.target.value)}
                placeholder="Interview with Acme"
                required
                type="text"
                value={title}
              />
            </label>

            <label className="profile-field">
              Date & time
              <input
                onChange={(inputEvent) => setStartsAt(inputEvent.target.value)}
                required
                type="datetime-local"
                value={startsAt}
              />
            </label>

            <label className="profile-field">
              Event type
              <select onChange={(inputEvent) => setEventType(inputEvent.target.value as EventType)} value={eventType}>
                <option value="interview">Interview</option>
                <option value="prep">Preparation</option>
                <option value="deadline">Deadline</option>
                <option value="focus">Focus session</option>
              </select>
            </label>

            <label className="profile-field">
              Notes
              <textarea
                onChange={(inputEvent) => setNotes(inputEvent.target.value)}
                placeholder="Optional context"
                rows={3}
                value={notes}
              />
            </label>

            <button className="primary-button" disabled={isSubmitting} type="submit">
              <AlarmClock size={15} /> {isSubmitting ? "Adding..." : "Add event"}
            </button>
          </form>

          {actionNotice ? <p className="settings-feedback success">{actionNotice}</p> : null}
          {actionError ? <p className="settings-feedback error">{actionError}</p> : null}
        </div>

        <div className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Upcoming</p>
              <h2>Scheduled missions</h2>
            </div>
          </div>

          <div className="calendar-upcoming-list">
            {upcomingEvents.length === 0 ? (
              <div className="empty-drop">No upcoming events. Add one to start your mission timeline.</div>
            ) : (
              upcomingEvents.map((eventItem) => {
                const startTime = new Date(eventItem.startsAt);

                return (
                  <article className="event-card" key={eventItem.id}>
                    <div className="calendar-day-tile">
                      <span>{startTime.toLocaleDateString(undefined, { month: "short" })}</span>
                      <strong>{String(startTime.getDate()).padStart(2, "0")}</strong>
                    </div>
                    <div>
                      <h3>{eventItem.title}</h3>
                      <p>
                        <Video size={12} /> {startTime.toLocaleString()}
                      </p>
                      {eventItem.notes ? <p>{eventItem.notes}</p> : null}
                    </div>
                    <button
                      aria-label={`Delete ${eventItem.title}`}
                      className="icon-button"
                      disabled={eventItem.origin === "job" || busyEventId === eventItem.id}
                      onClick={() => {
                        void handleDeleteEvent(eventItem);
                      }}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </aside>
    </section>
  );
}
