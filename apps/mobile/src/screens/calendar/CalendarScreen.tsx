import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AlarmClock, ChevronLeft, ChevronRight, Trash2 } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { useUserJobs } from "../../lib/jobs";
import { useUserReminders, createReminder, removeReminder } from "../../lib/reminders";
import type { ReminderType } from "../../types/reminder";
import { Card, EmptyState, ErrorText, GhostButton, Pill, PrimaryButton, Screen, SectionHeader, SuccessText, TextField } from "../../components/ui/Primitives";
import { PickerField } from "../../components/ui/PickerField";
import { DateTimeField } from "../../components/ui/DateTimeField";

type CalendarEvent = { id: string; title: string; notes: string; startsAt: string; type: ReminderType; origin: "job" | "reminder" };

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EVENT_COLOR: Record<ReminderType, "brand" | "success" | "danger" | "warning"> = {
  interview: "brand",
  prep: "success",
  deadline: "danger",
  focus: "warning"
};

const EVENT_TYPE_OPTIONS: { value: ReminderType; label: string }[] = [
  { value: "interview", label: "Interview" },
  { value: "prep", label: "Preparation" },
  { value: "deadline", label: "Deadline" },
  { value: "focus", label: "Focus session" }
];

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const grid: { dayKey: string; dayNumber: number; inCurrentMonth: boolean }[] = [];

  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    const day = daysInPrevMonth - i;
    grid.push({ dayKey: toDateKey(new Date(year, month - 1, day)), dayNumber: day, inCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    grid.push({ dayKey: toDateKey(new Date(year, month, day)), dayNumber: day, inCurrentMonth: true });
  }
  let nextDay = 1;
  while (grid.length < 42) {
    grid.push({ dayKey: toDateKey(new Date(year, month + 1, nextDay)), dayNumber: nextDay, inCurrentMonth: false });
    nextDay += 1;
  }
  return grid;
}

export default function CalendarScreen() {
  const { colors, fontSize } = useTheme();
  const { user } = useAuth();
  const { jobs } = useUserJobs(user?.uid);
  const { reminders } = useUserReminders(user?.uid);

  const [viewDate, setViewDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [eventType, setEventType] = useState<ReminderType>("focus");
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allEvents = useMemo<CalendarEvent[]>(() => {
    const reminderEvents: CalendarEvent[] = reminders.map((r) => ({ id: r.id, title: r.title, notes: r.notes, startsAt: r.startsAt, type: r.type, origin: "reminder" }));
    const jobEvents: CalendarEvent[] = jobs
      .filter((j) => Boolean(j.nextActionAt))
      .map((j) => ({
        id: `job-${j.id}`,
        title: `${j.company}: ${j.role}`,
        notes: `${j.company} / ${j.status}`,
        startsAt: j.nextActionAt ?? "",
        type: j.status === "interviewing" ? "interview" : j.status === "applied" ? "deadline" : "focus",
        origin: "job"
      }));
    return [...reminderEvents, ...jobEvents]
      .filter((e) => Number.isFinite(Date.parse(e.startsAt)))
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }, [jobs, reminders]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    allEvents.forEach((e) => {
      const key = toDateKey(new Date(e.startsAt));
      map.set(key, [...(map.get(key) ?? []), e]);
    });
    return map;
  }, [allEvents]);

  const monthGrid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const monthTitle = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const upcomingEvents = useMemo(() => allEvents.slice(0, 8), [allEvents]);

  async function handleAddEvent() {
    setActionError(null);
    setActionNotice(null);
    if (!title.trim() || !startsAt) {
      setActionError("Please enter a title and date/time for the event.");
      return;
    }
    if (!user) {
      setActionError("Please sign in to create calendar events.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createReminder(user.uid, { title: title.trim(), startsAt: startsAt.toISOString(), type: eventType, notes: notes.trim() });
      setTitle("");
      setStartsAt(null);
      setEventType("focus");
      setNotes("");
      setActionNotice("Event added to your CareerOS calendar.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to add event.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteEvent(eventItem: CalendarEvent) {
    if (!user || eventItem.origin !== "reminder") return;
    setActionError(null);
    setBusyEventId(eventItem.id);
    try {
      await removeReminder(user.uid, eventItem.id);
      setActionNotice("Event removed from your calendar.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to delete event.");
    } finally {
      setBusyEventId(null);
    }
  }

  return (
    <Screen>
      <SectionHeader
        eyebrow="Calendar"
        title="CareerOS private calendar"
        subtitle="Track interviews, prep, and deadlines with real account data."
        right={<Pill label="Google sync coming soon" tone="muted" />}
      />

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <GhostButton label="" icon={<ChevronLeft color={colors.text} size={16} />} onPress={() => setViewDate((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} />
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{monthTitle}</Text>
          <GhostButton label="" icon={<ChevronRight color={colors.text} size={16} />} onPress={() => setViewDate((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} />
        </View>

        <View style={{ flexDirection: "row" }}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} style={{ flex: 1, textAlign: "center", color: colors.muted, fontSize: 10, fontWeight: "700" }}>
              {label}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {monthGrid.map((day) => {
            const dayEvents = eventsByDay.get(day.dayKey) ?? [];
            return (
              <View
                key={day.dayKey}
                style={{
                  width: "14.28%",
                  minHeight: 46,
                  padding: 3,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                  opacity: day.inCurrentMonth ? 1 : 0.35
                }}
              >
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>{day.dayNumber}</Text>
                {dayEvents.length > 0 ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors[EVENT_COLOR[dayEvents[0].type]], marginTop: 2 }} /> : null}
              </View>
            );
          })}
        </View>
      </Card>

      <Card>
        <SectionHeader eyebrow="Add Event" title="Schedule a new item" />
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Interview with Acme" />
        <DateTimeField label="Date & time" value={startsAt} onChange={setStartsAt} mode="datetime" />
        <PickerField label="Event type" value={eventType} options={EVENT_TYPE_OPTIONS} onChange={setEventType} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional context" multiline numberOfLines={3} />
        {actionError ? <ErrorText text={actionError} /> : null}
        {actionNotice ? <SuccessText text={actionNotice} /> : null}
        <PrimaryButton label={isSubmitting ? "Adding..." : "Add event"} icon={<AlarmClock color="#fff" size={14} />} onPress={() => void handleAddEvent()} loading={isSubmitting} />
      </Card>

      <Card>
        <SectionHeader eyebrow="Upcoming" title="Scheduled missions" />
        {upcomingEvents.length === 0 ? (
          <EmptyState text="No upcoming events. Add one to start your mission timeline." />
        ) : (
          upcomingEvents.map((eventItem) => {
            const start = new Date(eventItem.startsAt);
            return (
              <View key={eventItem.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ width: 42, alignItems: "center" }}>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>{start.toLocaleDateString(undefined, { month: "short" })}</Text>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{String(start.getDate()).padStart(2, "0")}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }} numberOfLines={1}>
                    {eventItem.title}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{start.toLocaleString()}</Text>
                  {eventItem.notes ? (
                    <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                      {eventItem.notes}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  disabled={eventItem.origin === "job" || busyEventId === eventItem.id}
                  onPress={() => void handleDeleteEvent(eventItem)}
                  style={{ opacity: eventItem.origin === "job" ? 0.3 : 1, padding: 6 }}
                >
                  <Trash2 color={colors.danger} size={16} />
                </Pressable>
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}
