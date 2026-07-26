import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BookOpen, BrainCircuit, ChevronLeft, ChevronRight, FlaskConical, Sparkles } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { useUserPracticeAttempts } from "../../lib/practiceAttempts";
import { computeWeakTopicRows, fetchLearningLibrary, fetchTopicDetail, generateLearningPlan } from "../../lib/learningClient";
import type { AiLearningPlan, AiLearningPlanModule, LearningTrackId, TopicDetail, TrackSummary, WeakTopicRow } from "../../types/learning";
import { Card, ErrorText, LoadingView, Pill, PrimaryButton, Screen, SectionHeader } from "../../components/ui/Primitives";
import { TopicReadingContent } from "./TopicReadingContent";

const TRACK_ICONS: Record<LearningTrackId, typeof BookOpen> = {
  "computer-science": FlaskConical,
  ai: BrainCircuit
};

function HeaderBackButton({ color, onPress }: { color: string; onPress: () => void }) {
  return (
    <Pressable hitSlop={12} onPress={onPress} style={{ paddingHorizontal: 4 }}>
      <ChevronLeft color={color} size={24} />
    </Pressable>
  );
}

export default function LearningScreen() {
  const { colors, fontSize } = useTheme();
  const { user } = useAuth();
  const { attempts } = useUserPracticeAttempts(user?.uid);
  const navigation = useNavigation();

  const [tracks, setTracks] = useState<TrackSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedTrackId, setSelectedTrackId] = useState<LearningTrackId | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [topicDetail, setTopicDetail] = useState<TopicDetail | null>(null);
  const [topicLoading, setTopicLoading] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  const [weakRows, setWeakRows] = useState<WeakTopicRow[] | null>(null);
  const [plan, setPlan] = useState<AiLearningPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  /** This screen fakes drill-down navigation (Tracks -> Subjects -> Topics) with local state instead of a real
   *  nested stack (see navigation/types.ts), so there's no automatic header back button the way War Room's stack
   *  gets one - without this, the only way back was an in-body "Back to X" button, which isn't how Android screens
   *  behave and was inconsistent with the rest of the app. This drives the header's back arrow (replacing the
   *  Drawer's default hamburger only while drilled in) to match. */
  useLayoutEffect(() => {
    if (selectedTopicId) {
      navigation.setOptions({ headerLeft: () => <HeaderBackButton color={colors.text} onPress={() => setSelectedTopicId(null)} /> });
    } else if (selectedSubjectId) {
      navigation.setOptions({ headerLeft: () => <HeaderBackButton color={colors.text} onPress={() => setSelectedSubjectId(null)} /> });
    } else if (selectedTrackId) {
      navigation.setOptions({ headerLeft: () => <HeaderBackButton color={colors.text} onPress={() => setSelectedTrackId(null)} /> });
    } else {
      navigation.setOptions({ headerLeft: undefined });
    }
  }, [navigation, colors.text, selectedTopicId, selectedSubjectId, selectedTrackId]);

  useEffect(() => {
    let cancelled = false;
    fetchLearningLibrary()
      .then((payload) => {
        if (!cancelled) setTracks(payload.tracks);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Unable to load learning materials.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const completed = attempts.filter((a) => a.status === "submitted" || a.status === "timed_out");
    if (completed.length === 0) {
      setWeakRows([]);
      return;
    }
    let cancelled = false;
    computeWeakTopicRows(attempts)
      .then((rows) => {
        if (!cancelled) setWeakRows(rows.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setWeakRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [attempts]);

  const selectedTrack = useMemo(() => tracks?.find((t) => t.id === selectedTrackId) ?? null, [tracks, selectedTrackId]);
  const selectedSubject = useMemo(
    () => selectedTrack?.subjects.find((s) => s.id === selectedSubjectId) ?? null,
    [selectedTrack, selectedSubjectId]
  );

  function openTopic(topicId: string) {
    if (!selectedTrackId || !selectedSubjectId) return;
    setSelectedTopicId(topicId);
    setTopicDetail(null);
    setTopicError(null);
    setTopicLoading(true);
    fetchTopicDetail(selectedTrackId, selectedSubjectId, topicId)
      .then(setTopicDetail)
      .catch((err) => setTopicError(err instanceof Error ? err.message : "Unable to load this topic."))
      .finally(() => setTopicLoading(false));
  }

  async function handleGeneratePlan() {
    if (!tracks || planLoading) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const tracksPayload = tracks
        .filter((t) => t.available && t.subjects.length > 0)
        .map((t) => ({
          id: t.id,
          title: t.title,
          subjects: t.subjects.map((s) => ({ id: s.id, order: s.order, overview: s.overview, title: s.title, topicCount: s.topicCount }))
        }));
      const weakRowsPayload = (weakRows ?? []).map((r) => ({ earned: r.earned, percentage: r.percentage, subtopic: r.subtopic, topic: r.topic, total: r.total }));
      const result = await generateLearningPlan(tracksPayload, weakRowsPayload);
      setPlan(result);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Unable to generate a learning plan.");
    } finally {
      setPlanLoading(false);
    }
  }

  function openPlanModule(module: AiLearningPlanModule) {
    if (module.trackId !== "computer-science" && module.trackId !== "ai") return;
    setSelectedTrackId(module.trackId as LearningTrackId);
    setSelectedSubjectId(module.subjectId);
    setSelectedTopicId(null);
    setTopicDetail(null);
  }

  if (selectedTopicId && selectedSubject) {
    return (
      <Screen>
        {topicLoading ? <LoadingView label="Loading topic..." /> : null}
        {topicError ? <ErrorText text={topicError} /> : null}
        {topicDetail ? (
          <Card>
            <SectionHeader eyebrow={topicDetail.subjectTitle} title={topicDetail.title} subtitle={`Difficulty: ${topicDetail.difficulty}`} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {topicDetail.focusKeywords.map((keyword) => (
                <Pill key={keyword} label={keyword} tone="brand" />
              ))}
            </View>
            <TopicReadingContent detail={topicDetail} />
          </Card>
        ) : null}
      </Screen>
    );
  }

  if (selectedTrackId && selectedSubject) {
    return (
      <Screen>
        <SectionHeader eyebrow={selectedTrack?.title} title={selectedSubject.title} subtitle={selectedSubject.overview} />
        {selectedSubject.topics.map((topic) => (
          <Pressable
            key={topic.id}
            onPress={() => openTopic(topic.id)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }}>{topic.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{topic.difficulty}</Text>
            </View>
            <ChevronRight color={colors.muted} size={16} />
          </Pressable>
        ))}
        {selectedSubject.capstoneTasks.length > 0 ? (
          <Card>
            <SectionHeader eyebrow="Capstone" title="Apply what you learned" />
            {selectedSubject.capstoneTasks.map((task) => (
              <Text key={task} style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>
                - {task}
              </Text>
            ))}
          </Card>
        ) : null}
      </Screen>
    );
  }

  if (selectedTrackId && selectedTrack) {
    return (
      <Screen>
        <SectionHeader eyebrow="Learning Center" title={selectedTrack.title} subtitle={selectedTrack.description} />
        {selectedTrack.subjects.map((subject) => (
          <Pressable
            key={subject.id}
            onPress={() => setSelectedSubjectId(subject.id)}
            style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 4 }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.sm }}>{subject.title}</Text>
              <Pill label={`${subject.topicCount} topics`} tone="muted" />
            </View>
            <Text style={{ color: colors.muted, fontSize: fontSize.sm }} numberOfLines={2}>
              {subject.overview}
            </Text>
          </Pressable>
        ))}
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader eyebrow="Learning Center" title="Structured study tracks" subtitle="Deep-dive reading material across Computer Science and AI." />

      {loadError ? <ErrorText text={loadError} /> : null}
      {!tracks && !loadError ? <LoadingView label="Loading learning materials..." /> : null}

      {tracks?.map((track) => {
        const Icon = TRACK_ICONS[track.id];
        return (
          <Pressable
            key={track.id}
            disabled={!track.available}
            onPress={() => setSelectedTrackId(track.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: track.available ? 1 : 0.5
            }}
          >
            <Icon color={colors.brand} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{track.title}</Text>
              <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>
                {track.available ? `${track.subjects.length} subjects / ${track.topicCount} topics` : "Content coming soon"}
              </Text>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </Pressable>
        );
      })}

      <Card highlight>
        <SectionHeader eyebrow="AI Study Plan" title="Generate my study plan" subtitle="Uses your War Room test history to prioritize weak topics first." />
        {weakRows === null ? (
          <LoadingView label="Checking your test history..." />
        ) : weakRows.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No completed War Room tests yet - the plan will fall back to a balanced curriculum order.</Text>
        ) : (
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }}>Weakest areas right now</Text>
            {weakRows.map((row) => (
              <Text key={row.key} style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>
                {row.topic} / {row.subtopic} - {row.percentage}% ({row.earned}/{row.total})
              </Text>
            ))}
          </View>
        )}
        {planError ? <ErrorText text={planError} /> : null}
        <PrimaryButton
          label={planLoading ? "Generating..." : "Generate my study plan"}
          icon={<Sparkles color="#fff" size={14} />}
          onPress={() => void handleGeneratePlan()}
          loading={planLoading}
        />
      </Card>

      {plan ? (
        <Card>
          <SectionHeader eyebrow="Your Plan" title={plan.hasTestHistory ? "Prioritized from your test history" : "Balanced starting plan"} subtitle={plan.summary} />
          {plan.modules.map((module) => (
            <Pressable
              key={`${module.trackId}-${module.subjectId}`}
              onPress={() => openPlanModule(module)}
              style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 4 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }}>
                  {module.priority}. {module.subjectTitle}
                </Text>
                <Pill label={module.trackTitle} tone="brand" />
              </View>
              <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>{module.reason}</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
