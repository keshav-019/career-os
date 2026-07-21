import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Loader2, Play } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { createPracticeAttempt, fetchTemplateLibrary, useUserPracticeAttempts, type PracticeAttemptRecord } from "../../lib/practiceAttempts";
import { formatInterviewTestType, type InterviewTestTemplate } from "../../types/practiceAttempt";
import type { WarRoomStackParamList } from "../../navigation/types";
import { Card, EmptyState, ErrorText, GhostButton, LoadingView, Pill, PrimaryButton, Screen, SectionHeader } from "../../components/ui/Primitives";

type Props = NativeStackScreenProps<WarRoomStackParamList, "TemplateList">;

type Filter = "all" | "attempted" | "not_attempted";

function statusLabel(status: PracticeAttemptRecord["status"]): string {
  if (status === "in_progress") return "In Progress";
  if (status === "timed_out") return "Timed Out";
  if (status === "submitted") return "Submitted";
  return "Ready";
}

function hasAttemptStarted(attempt: PracticeAttemptRecord): boolean {
  return attempt.status === "in_progress" || attempt.status === "submitted" || attempt.status === "timed_out" || Boolean(attempt.startedAt);
}

function formatAttemptScore(attempt: PracticeAttemptRecord): string {
  const total = attempt.score?.total ?? 0;
  if (total <= 0) return "Not auto-scored";
  return `${attempt.score?.percentage ?? 0}% (${attempt.score?.correct ?? 0}/${total})`;
}

export default function TemplateListScreen({ route, navigation }: Props) {
  const { testType, roleId, roleName } = route.params;
  const { colors, fontSize } = useTheme();
  const { user } = useAuth();
  const { attempts } = useUserPracticeAttempts(user?.uid);

  const [templates, setTemplates] = useState<InterviewTestTemplate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: roleName ? `${roleName} Tests` : `${formatInterviewTestType(testType)} Tests` });
  }, [navigation, roleName, testType]);

  useEffect(() => {
    let cancelled = false;
    fetchTemplateLibrary(testType, roleId)
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load this test library.");
      });
    return () => {
      cancelled = true;
    };
  }, [testType, roleId]);

  const templatesWithStats = useMemo(() => {
    if (!templates) return [];
    const byTemplateId = new Map<string, PracticeAttemptRecord[]>();
    attempts
      .filter((a) => a.testType === testType && a.testTemplateId)
      .forEach((a) => {
        const list = byTemplateId.get(a.testTemplateId as string) ?? [];
        list.push(a);
        byTemplateId.set(a.testTemplateId as string, list);
      });
    return templates.map((template) => {
      const templateAttempts = byTemplateId.get(template.id) ?? [];
      const started = templateAttempts.filter(hasAttemptStarted);
      return { template, attemptCount: started.length, latestAttempt: templateAttempts[0] ?? null };
    });
  }, [attempts, templates, testType]);

  const attemptedCount = templatesWithStats.filter((t) => t.attemptCount > 0).length;

  const visible = useMemo(() => {
    if (filter === "attempted") return templatesWithStats.filter((t) => t.attemptCount > 0);
    if (filter === "not_attempted") return templatesWithStats.filter((t) => t.attemptCount === 0);
    return templatesWithStats;
  }, [filter, templatesWithStats]);

  async function handleStart(template: InterviewTestTemplate) {
    if (!user) {
      setActionError("Please sign in before starting a test.");
      return;
    }
    setActionError(null);
    setLaunchingId(template.id);
    try {
      const attemptId = await createPracticeAttempt(user.uid, template.testType, template.id, roleId);
      navigation.navigate("TestRoom", { attemptId });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to start this test right now.");
    } finally {
      setLaunchingId(null);
    }
  }

  if (loadError) {
    return (
      <Screen>
        <ErrorText text={loadError} />
      </Screen>
    );
  }

  if (!templates) {
    return (
      <Screen>
        <LoadingView label="Loading test library..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader
        eyebrow="Test Library"
        title={roleName ? `${roleName} tests` : `${formatInterviewTestType(testType)} test sets`}
        subtitle={`${templates.length} compiled tests available.`}
      />

      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["all", "attempted", "not_attempted"] as Filter[]).map((tab) => {
          const count = tab === "all" ? templates.length : tab === "attempted" ? attemptedCount : templates.length - attemptedCount;
          const active = filter === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setFilter(tab)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: active ? colors.brand : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.border
              }}
            >
              <Text style={{ color: active ? "#fff" : colors.text, fontSize: fontSize.sm, fontWeight: "700" }}>
                {tab === "all" ? "All" : tab === "attempted" ? "Attempted" : "Not Attempted"} {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {actionError ? <ErrorText text={actionError} /> : null}

      {visible.length === 0 ? (
        <EmptyState text="No tests found in this filter yet." />
      ) : (
        visible.map(({ template, attemptCount, latestAttempt }) => {
          const isLaunching = launchingId === template.id;
          const canResume = latestAttempt && (latestAttempt.status === "ready" || latestAttempt.status === "in_progress");
          return (
            <Card key={template.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md, flex: 1 }}>{template.title}</Text>
                <Pill label={attemptCount > 0 ? `${attemptCount} attempts` : "Not attempted"} tone={attemptCount > 0 ? "success" : "warning"} />
              </View>
              <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>{template.subtitle}</Text>
              <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>{template.summary}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {template.categoryFocus.map((category) => (
                  <Pill key={category} label={category} tone="muted" />
                ))}
              </View>
              {latestAttempt ? (
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  Latest: {statusLabel(latestAttempt.status)} - Score: {formatAttemptScore(latestAttempt)}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {canResume ? (
                  <GhostButton label="Continue Attempt" onPress={() => navigation.navigate("TestRoom", { attemptId: latestAttempt.id })} />
                ) : null}
                <PrimaryButton
                  label={isLaunching ? "Creating..." : attemptCount > 0 ? "Retake Test" : "Start Test"}
                  icon={isLaunching ? <Loader2 color="#fff" size={14} /> : <Play color="#fff" size={14} />}
                  onPress={() => void handleStart(template)}
                  disabled={launchingId !== null}
                  loading={isLaunching}
                />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
