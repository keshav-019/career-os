import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useUserJobs } from "../../lib/jobs";
import type { CareerJob, JobStatus } from "../../types/job";
import { useTheme } from "../../theme/ThemeContext";
import { Card, EmptyState, LoadingView, MetricCard, MetricGrid, Pill, Screen, SectionHeader } from "../../components/ui/Primitives";
import { BarChart } from "../../components/ui/BarChart";

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

function buildVelocityBars(jobs: CareerJob[]) {
  const days: { label: string; value: number }[] = [];
  const counts = new Map<string, number>();
  jobs.forEach((job) => {
    const date = new Date(job.savedAt);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  for (let i = 13; i >= 0; i--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    days.push({ label: day.toLocaleDateString(undefined, { day: "numeric", month: "short" }), value: counts.get(key) ?? 0 });
  }
  return days;
}

const BOARD_COLUMNS: { title: string; tone: "brand" | "warning" | "success"; statuses: JobStatus[] }[] = [
  { title: "Technical Round", tone: "brand", statuses: ["interviewing"] },
  { title: "Decision Queue", tone: "warning", statuses: ["applied", "saved"] },
  { title: "Offers", tone: "success", statuses: ["offer"] }
];

export default function DashboardScreen() {
  const { colors, fontSize } = useTheme();
  const { user } = useAuth();
  const { jobs, loading } = useUserJobs(user?.uid);

  const metrics = useMemo(() => {
    const activeStatuses: JobStatus[] = ["saved", "applied", "interviewing", "offer"];
    const activePipeline = jobs.filter((j) => activeStatuses.includes(j.status)).length;
    const interviewing = jobs.filter((j) => j.status === "interviewing").length;
    const responseBase = jobs.filter((j) => ["applied", "interviewing", "offer", "rejected"].includes(j.status)).length;
    const recruiterReplies = jobs.filter((j) => ["interviewing", "offer", "rejected"].includes(j.status)).length;
    const interviewRate = responseBase > 0 ? Math.round(((interviewing + jobs.filter((j) => j.status === "offer").length) / responseBase) * 100) : 0;
    const responseRate = responseBase > 0 ? Math.round((recruiterReplies / responseBase) * 100) : 0;
    const averageFit = jobs.length > 0 ? Math.round(jobs.reduce((sum, j) => sum + (j.fitScore || 0), 0) / jobs.length) : 0;
    return { activePipeline, interviewing, interviewRate, averageFit, recruiterReplies, responseRate };
  }, [jobs]);

  const velocityBars = useMemo(() => buildVelocityBars(jobs), [jobs]);

  const nextActionJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.nextActionAt)
        .sort((a, b) => new Date(a.nextActionAt!).getTime() - new Date(b.nextActionAt!).getTime())
        .slice(0, 8),
    [jobs]
  );

  if (loading) {
    return (
      <Screen>
        <LoadingView label="Loading your dashboard..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader eyebrow="Overview" title="Command Center" subtitle="Your job search at a glance." />

      <MetricGrid>
        <MetricCard
          label="Active Pipeline"
          value={String(metrics.activePipeline)}
          detail={`${metrics.activePipeline} active opportunities`}
          tone="brand"
        />
        <MetricCard label="Interviews" value={String(metrics.interviewing)} detail={`${metrics.interviewRate}% interview rate`} tone="success" />
        <MetricCard label="Resume Match" value={`${metrics.averageFit}%`} detail="Average across saved jobs" tone="warning" />
        <MetricCard
          label="Recruiter Replies"
          value={String(metrics.recruiterReplies)}
          detail={`${metrics.responseRate}% response rate`}
          tone="danger"
        />
      </MetricGrid>

      <Card>
        <SectionHeader eyebrow="Command Pipeline" title="Active mission board" subtitle="Live applications by stage. Tap a card for details." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {BOARD_COLUMNS.map((column) => {
            const columnJobs = jobs.filter((j) => column.statuses.includes(j.status));
            return (
              <View
                key={column.title}
                style={{ width: 220, backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 10, gap: 8 }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.sm }}>{column.title}</Text>
                  <Pill label={String(columnJobs.length)} tone={column.tone} />
                </View>
                {columnJobs.length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No roles in this lane yet.</Text>
                ) : (
                  columnJobs.slice(0, 5).map((job) => (
                    <View
                      key={job.id}
                      style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 10, gap: 4, borderWidth: 1, borderColor: colors.border }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }} numberOfLines={1}>
                        {job.role}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                        {job.company} / {job.location}
                      </Text>
                      <Pill label={`Match ${job.fitScore}%`} tone={job.fitScore >= 85 ? "success" : "brand"} />
                    </View>
                  ))
                )}
              </View>
            );
          })}
        </ScrollView>
      </Card>

      <Card>
        <SectionHeader eyebrow="Application Velocity" title="14-day trend" subtitle="Job activity saved over the last 14 days." />
        {jobs.length === 0 ? <EmptyState text="No job activity yet." /> : <BarChart data={velocityBars} />}
      </Card>

      <Card>
        <SectionHeader eyebrow="Calendar Queue" title="Next actions" />
        {nextActionJobs.length === 0 ? (
          <EmptyState text="No pending follow-ups. Save jobs and add next-action dates to build your queue." />
        ) : (
          nextActionJobs.map((job) => (
            <View key={job.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "800" }}>{job.company.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }} numberOfLines={1}>
                  {job.company}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                  {job.role}
                </Text>
              </View>
              <Pill label={formatShortDate(job.nextActionAt!)} tone="brand" />
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
