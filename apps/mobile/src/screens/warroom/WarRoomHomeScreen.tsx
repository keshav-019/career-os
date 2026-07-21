import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BrainCircuit, Calculator, Code2, FlaskConical, Network } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { useUserJobs } from "../../lib/jobs";
import { useUserPracticeAttempts, type PracticeAttemptRecord } from "../../lib/practiceAttempts";
import { fetchAiRoles } from "../../lib/practiceAttempts";
import type { AiInterviewRole, InterviewTestType } from "../../types/practiceAttempt";
import type { WarRoomStackParamList } from "../../navigation/types";
import {
  Card,
  EmptyState,
  GhostButton,
  LoadingView,
  MetricCard,
  MetricGrid,
  Pill,
  Screen,
  SectionHeader
} from "../../components/ui/Primitives";

type Props = NativeStackScreenProps<WarRoomStackParamList, "WarRoomHome">;

const TRACK_META: Record<
  Exclude<InterviewTestType, "coding">,
  { title: string; subtitle: string; icon: typeof Calculator }
> = {
  aptitude: { title: "Aptitude Sprint", subtitle: "40 questions / 60 minutes", icon: Calculator },
  "computer-science": { title: "Computer Science Technical", subtitle: "30 questions / 60 minutes", icon: FlaskConical },
  ai: { title: "AI Technical", subtitle: "40 questions / 90 minutes - choose a role first", icon: BrainCircuit }
};

function statusTone(status: PracticeAttemptRecord["status"]): "success" | "danger" | "brand" | "warning" {
  if (status === "submitted") return "success";
  if (status === "timed_out") return "danger";
  if (status === "in_progress") return "brand";
  return "warning";
}

function statusLabel(status: PracticeAttemptRecord["status"]): string {
  if (status === "in_progress") return "In Progress";
  if (status === "timed_out") return "Timed Out";
  if (status === "submitted") return "Submitted";
  return "Ready";
}

function hasAttemptStarted(attempt: PracticeAttemptRecord): boolean {
  return attempt.status === "in_progress" || attempt.status === "submitted" || attempt.status === "timed_out" || Boolean(attempt.startedAt);
}

export default function WarRoomHomeScreen({ navigation }: Props) {
  const { colors, fontSize } = useTheme();
  const { user } = useAuth();
  const { jobs } = useUserJobs(user?.uid);
  const { attempts, loading } = useUserPracticeAttempts(user?.uid);

  const [aiPickerOpen, setAiPickerOpen] = useState(false);
  const [aiRoles, setAiRoles] = useState<AiInterviewRole[] | null>(null);
  const [aiRolesError, setAiRolesError] = useState<string | null>(null);

  useEffect(() => {
    if (!aiPickerOpen || aiRoles) return;
    fetchAiRoles()
      .then(setAiRoles)
      .catch((err) => setAiRolesError(err instanceof Error ? err.message : "Could not load AI roles."));
  }, [aiPickerOpen, aiRoles]);

  const metrics = useMemo(() => {
    const started = attempts.filter(hasAttemptStarted);
    const completed = started.filter((a) => a.status === "submitted" || a.status === "timed_out");
    const scored = completed.filter((a) => (a.score?.total ?? 0) > 0);
    const averageScore = scored.length > 0 ? Math.round(scored.reduce((sum, a) => sum + (a.score?.percentage ?? 0), 0) / scored.length) : 0;
    return {
      totalAttempts: started.length,
      activeAttempts: started.filter((a) => a.status === "in_progress").length,
      averageScore,
      interviewingJobs: jobs.filter((j) => j.status === "interviewing").length
    };
  }, [attempts, jobs]);

  const recentAttempts = useMemo(() => attempts.slice(0, 8), [attempts]);

  function openMcqTrack(testType: Exclude<InterviewTestType, "coding" | "ai">) {
    navigation.navigate("TemplateList", { testType });
  }

  function openAiRole(role: AiInterviewRole) {
    setAiPickerOpen(false);
    navigation.navigate("TemplateList", { testType: "ai", roleId: role.id, roleName: role.name });
  }

  return (
    <Screen>
      <SectionHeader eyebrow="Interview War Room" title="Practice under pressure" subtitle="Pick a track, launch a timed test, and review your score." />

      <MetricGrid>
        <MetricCard label="Total Attempts" value={String(metrics.totalAttempts)} detail="Rounds actually started" tone="brand" />
        <MetricCard label="Active Tests" value={String(metrics.activeAttempts)} detail="Currently in progress" tone="success" />
        <MetricCard label="Avg MCQ Score" value={`${metrics.averageScore}%`} detail="Aptitude, CS, and AI" tone="warning" />
        <MetricCard label="Interviews" value={String(metrics.interviewingJobs)} detail="From your Applications pipeline" tone="danger" />
      </MetricGrid>

      {aiPickerOpen ? (
        <Card highlight>
          <SectionHeader
            eyebrow="AI Track"
            title="Choose a role"
            subtitle="Pick one of the AI role tracks to open its 100 compiled tests."
            right={<GhostButton label="Back" onPress={() => setAiPickerOpen(false)} />}
          />
          {aiRolesError ? <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>{aiRolesError}</Text> : null}
          {!aiRoles && !aiRolesError ? <LoadingView label="Loading AI roles..." /> : null}
          {aiRoles?.map((role) => (
            <Pressable
              key={role.id}
              onPress={() => openAiRole(role)}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 12,
                backgroundColor: colors.surface,
                gap: 3
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{role.name}</Text>
              <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>{role.summary}</Text>
              <Pill label={`${role.questionCount} curated questions`} tone="brand" />
            </Pressable>
          ))}
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => navigation.navigate("CodingGate")}
            style={{ borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.warning, borderRadius: 12, padding: 14, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <Code2 color={colors.warning} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>Coding Simulation</Text>
              <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>Desktop-only execution - view details on phone.</Text>
            </View>
          </Pressable>

          {(["aptitude", "computer-science"] as const).map((testType) => {
            const meta = TRACK_META[testType];
            const Icon = meta.icon;
            return (
              <Pressable
                key={testType}
                onPress={() => openMcqTrack(testType)}
                style={{ borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.brand, borderRadius: 12, padding: 14, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Icon color={colors.brand} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{meta.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>{meta.subtitle}</Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => setAiPickerOpen(true)}
            style={{ borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.brand, borderRadius: 12, padding: 14, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <BrainCircuit color={colors.brand} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{TRACK_META.ai.title}</Text>
              <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>{TRACK_META.ai.subtitle}</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("SystemDesignList")}
            style={{ borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.success, borderRadius: 12, padding: 14, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <Network color={colors.success} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>System Design</Text>
              <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>Tap a component, then tap a slot to place it - top down.</Text>
            </View>
          </Pressable>
        </View>
      )}

      <Card>
        <SectionHeader eyebrow="Recent Attempts" title="Live practice history" subtitle="Continue in-progress tests or review submitted performance." />
        {loading ? (
          <LoadingView label="Loading attempts..." />
        ) : recentAttempts.length === 0 ? (
          <EmptyState text="No attempts yet. Start your first test from a track above." />
        ) : (
          recentAttempts.map((attempt) => (
            <Pressable
              key={attempt.id}
              onPress={() => navigation.navigate("TestRoom", { attemptId: attempt.id })}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }} numberOfLines={1}>
                  {attempt.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {attempt.startedAt ? new Date(attempt.startedAt).toLocaleString() : "Not started"}
                </Text>
              </View>
              <Pill label={statusLabel(attempt.status)} tone={statusTone(attempt.status)} />
            </Pressable>
          ))
        )}
      </Card>
    </Screen>
  );
}
