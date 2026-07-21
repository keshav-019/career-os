// Mirrors CalendarReminder from apps/web/src/lib/firebase/reminders.ts.
export type ReminderType = "interview" | "prep" | "deadline" | "focus";

export type CalendarReminder = {
  id: string;
  title: string;
  startsAt: string;
  type: ReminderType;
  notes: string;
  createdAt?: string;
};
