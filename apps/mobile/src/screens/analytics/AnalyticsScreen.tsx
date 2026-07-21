import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { useUserPracticeAttempts, fetchMcqReview, type PracticeAttemptRecord } from "../../lib/practiceAttempts";
import type { InterviewTestType } from "../../types/practiceAttempt";
import { Card, EmptyState, GhostButton, LoadingView, MetricCard, MetricGrid, Pill, ProgressBar, Screen, SectionHeader } from "../../components/ui/Primitives";
import { PickerField } from "../../components/ui/PickerField";
import { BarChart } from "../../components/ui/BarChart";

type TrackFilter = "all" | InterviewTestType;

const TRACK_OPTIONS: { value: TrackFilter; label: string }[] = [
  { value: "all", label: "All Tracks" },
  { value: "coding", label: "Coding" },
  { value: "aptitude", label: "Aptitude" },
  { value: "computer-science", label: "Computer Science" },
  { value: "ai", label: "AI" }
];

const SUMMARY_PAGE_SIZE = 5;

function formatTestType(testType: string): string {
  if (testType === "computer-science") return "Computer Science";
  if (testType === "ai") return "AI";
  return testType.charAt(0).toUpperCase() + testType.slice(1);
}

function formatShortDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type AttemptPoint = {
  attempt: PracticeAttemptRecord;
  scorePercent: number;
  earned: number;
  total: number;
  submittedAtMs: number;
};

type TopicRow = { key: string; topic: string; subtopic: string; earned: number; total: number; percentage: number };

export default function AnalyticsScreen() {
  const { colors, fontSize } = useTheme();
  const { user } = useAuth();
  const { attempts, loading } = useUserPracticeAttempts(user?.uid);

  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");
  const [summaryPage, setSummaryPage] = useState(1);
  const [correctById, setCorrectById] = useState<Map<string, string> | null>(null);

  const completedAttempts = useMemo(() => attempts.filter((a) => a.status === "submitted" || a.status === "timed_out"), [attempts]);

  useEffect(() => {
    if (completedAttempts.length === 0) {
      setCorrectById(new Map());
      return;
    }
    const allIds = new Set<string>();
    completedAttempts.forEach((a) => a.questions.forEach((q) => q.kind === "mcq" && allIds.add(q.id)));
    if (allIds.size === 0) {
      setCorrectById(new Map());
      return;
    }
    let cancelled = false;
    fetchMcqReview([...allIds], {})
      .then(({ reviews }) => {
        if (!cancelled) setCorrectById(new Map(Object.entries(reviews).map(([id, r]) => [id, r.correctOptionId])));
      })
      .catch(() => {
        if (!cancelled) setCorrectById(new Map());
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedAttempts.length]);

  const points = useMemo<AttemptPoint[]>(() => {
    if (!correctById) return [];
    return completedAttempts
      .map((attempt) => {
        let earned = 0;
        let total = 0;
        if (attempt.mode === "mcq" && (attempt.score?.total ?? 0) > 0) {
          earned = attempt.score?.correct ?? 0;
          total = attempt.score?.total ?? 0;
        } else {
          attempt.questions.forEach((q) => {
            total += 1;
            if (q.kind === "mcq") {
              const selected = (attempt.mcqAnswers[q.id] ?? "").trim().toLowerCase();
              const correct = correctById.get(q.id);
              if (correct && selected && selected === correct) earned += 1;
            } else if (attempt.codingCompletion[q.id] === true) {
              earned += 1;
            }
          });
        }
        const submittedAtMs = Date.parse(attempt.submittedAt ?? attempt.createdAt) || 0;
        return { attempt, earned, total, scorePercent: total > 0 ? Math.round((earned / total) * 100) : 0, submittedAtMs };
      })
      .sort((a, b) => a.submittedAtMs - b.submittedAtMs);
  }, [completedAttempts, correctById]);

  const filteredPoints = useMemo(() => (trackFilter === "all" ? points : points.filter((p) => p.attempt.testType === trackFilter)), [points, trackFilter]);

  const summaryMetrics = useMemo(() => {
    const total = filteredPoints.length;
    const averageScore = total > 0 ? Math.round(filteredPoints.reduce((sum, p) => sum + p.scorePercent, 0) / total) : 0;
    const bestScore = total > 0 ? filteredPoints.reduce((max, p) => Math.max(max, p.scorePercent), 0) : 0;
    const latestScore = total > 0 ? filteredPoints[total - 1].scorePercent : 0;
    const firstScore = total > 1 ? filteredPoints[0].scorePercent : latestScore;
    return { total, averageScore, bestScore, latestScore, trendDelta: total > 1 ? latestScore - firstScore : 0 };
  }, [filteredPoints]);

  const topicRows = useMemo<TopicRow[]>(() => {
    const tracker = new Map<string, TopicRow>();
    filteredPoints.forEach(({ attempt }) => {
      const topic = formatTestType(attempt.testType);
      attempt.questions.forEach((question) => {
        const subtopic = question.category || "General";
        const key = `${topic}::${subtopic}`;
        let earned = 0;
        if (question.kind === "mcq") {
          const selected = (attempt.mcqAnswers[question.id] ?? "").trim().toLowerCase();
          const correct = correctById?.get(question.id);
          earned = correct && selected && selected === correct ? 1 : 0;
        } else {
          earned = attempt.codingCompletion[question.id] === true ? 1 : 0;
        }
        const current = tracker.get(key) ?? { key, topic, subtopic, earned: 0, total: 0, percentage: 0 };
        current.earned += earned;
        current.total += 1;
        tracker.set(key, current);
      });
    });
    return [...tracker.values()].map((row) => ({ ...row, percentage: row.total > 0 ? Math.round((row.earned / row.total) * 100) : 0 }));
  }, [filteredPoints, correctById]);

  const strongestRows = useMemo(() => [...topicRows].sort((a, b) => b.percentage - a.percentage).slice(0, 5), [topicRows]);
  const weakestRows = useMemo(() => [...topicRows].sort((a, b) => a.percentage - b.percentage).slice(0, 5), [topicRows]);

  const totalPages = Math.max(1, Math.ceil(filteredPoints.length / SUMMARY_PAGE_SIZE));
  const activePage = Math.min(summaryPage, totalPages);
  const paginated = filteredPoints.slice((activePage - 1) * SUMMARY_PAGE_SIZE, activePage * SUMMARY_PAGE_SIZE);
  const chartData = filteredPoints.slice(-14).map((p) => ({ label: formatShortDate(p.attempt.submittedAt ?? p.attempt.createdAt), value: p.scorePercent }));

  if (loading || !correctById) {
    return (
      <Screen>
        <LoadingView label="Loading analytics..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader eyebrow="Analytics" title="Test performance" subtitle="Scores and topic strength computed from your War Room attempts." />

      <PickerField
        label="Track"
        value={trackFilter}
        options={TRACK_OPTIONS}
        onChange={(v) => {
          setTrackFilter(v);
          setSummaryPage(1);
        }}
      />

      <MetricGrid>
        <MetricCard label="Tests Taken" value={String(summaryMetrics.total)} detail="Submitted attempts" tone="success" />
        <MetricCard label="Average Score" value={`${summaryMetrics.averageScore}/100`} tone="brand" />
        <MetricCard label="Best Score" value={`${summaryMetrics.bestScore}/100`} tone="warning" />
        <MetricCard label="Latest Score" value={`${summaryMetrics.latestScore}/100`} detail={`Trend ${summaryMetrics.trendDelta >= 0 ? "+" : ""}${summaryMetrics.trendDelta}`} tone="danger" />
      </MetricGrid>

      <Card>
        <SectionHeader eyebrow="Score Timeline" title="Test performance trend" subtitle="Last 14 submitted attempts, out of 100." />
        {filteredPoints.length === 0 ? <EmptyState text="Attempt a test so you can view this section." /> : <BarChart data={chartData} />}
      </Card>

      <Card>
        <SectionHeader eyebrow="Attempt Summary" title="Tests in range" right={<Pill label={`${filteredPoints.length} attempts`} tone="brand" />} />
        {filteredPoints.length === 0 ? (
          <EmptyState text="Attempt a test so you can view this section." />
        ) : (
          <>
            {paginated.map((point) => (
              <View key={point.attempt.id} style={{ gap: 4, paddingVertical: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm, flex: 1 }} numberOfLines={1}>
                    {point.attempt.title}
                  </Text>
                  <Pill label={`${point.scorePercent}/100`} tone="brand" />
                </View>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {formatTestType(point.attempt.testType)} / {point.attempt.mode.toUpperCase()} - {point.earned}/{point.total}
                </Text>
                <ProgressBar percentage={point.scorePercent} tone="brand" />
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <GhostButton label="Previous" onPress={() => setSummaryPage((p) => Math.max(1, p - 1))} disabled={activePage <= 1} />
              <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>
                Page {activePage} / {totalPages}
              </Text>
              <GhostButton label="Next" onPress={() => setSummaryPage((p) => Math.min(totalPages, p + 1))} disabled={activePage >= totalPages} />
            </View>
          </>
        )}
      </Card>

      <Card>
        <SectionHeader eyebrow="Topic Intelligence" title="Strongest topics" />
        {strongestRows.length === 0 ? (
          <EmptyState text="Attempt a test so you can view this section." />
        ) : (
          strongestRows.map((row) => (
            <View key={`strong-${row.key}`} style={{ gap: 3, paddingVertical: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }}>{row.subtopic}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {row.earned}/{row.total}
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{row.topic}</Text>
              <ProgressBar percentage={row.percentage} tone="success" />
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionHeader eyebrow="Topic Intelligence" title="Weakest topics" />
        {weakestRows.length === 0 ? (
          <EmptyState text="Attempt a test so you can view this section." />
        ) : (
          weakestRows.map((row) => (
            <View key={`weak-${row.key}`} style={{ gap: 3, paddingVertical: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }}>{row.subtopic}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {row.earned}/{row.total}
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{row.topic}</Text>
              <ProgressBar percentage={row.percentage} tone="warning" />
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
