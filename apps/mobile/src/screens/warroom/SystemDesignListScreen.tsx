import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Network } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { listSystemDesignProblems } from "../../lib/systemDesignClient";
import type { SystemDesignProblemSummary } from "../../types/systemDesign";
import type { WarRoomStackParamList } from "../../navigation/types";
import { Card, EmptyState, ErrorText, LoadingView, Pill, PrimaryButton, Screen, SectionHeader } from "../../components/ui/Primitives";

type Props = NativeStackScreenProps<WarRoomStackParamList, "SystemDesignList">;

type TrackFilter = "all" | "classic" | "ml" | "mlops";

const FILTERS: { id: TrackFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "classic", label: "Classic Systems" },
  { id: "ml", label: "ML" },
  { id: "mlops", label: "MLOps" }
];

function matchesFilter(problem: SystemDesignProblemSummary, filter: TrackFilter): boolean {
  if (filter === "all") return true;
  if (filter === "ml") return problem.tags.includes("ML");
  if (filter === "mlops") return problem.tags.includes("MLOps");
  return !problem.tags.includes("ML") && !problem.tags.includes("MLOps");
}

function difficultyTone(difficulty: SystemDesignProblemSummary["difficulty"]): "success" | "warning" | "danger" {
  if (difficulty === "easy") return "success";
  if (difficulty === "medium") return "warning";
  return "danger";
}

export default function SystemDesignListScreen({ navigation }: Props) {
  const { colors, fontSize } = useTheme();
  const [problems, setProblems] = useState<SystemDesignProblemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TrackFilter>("all");

  useEffect(() => {
    let cancelled = false;
    listSystemDesignProblems()
      .then((list) => {
        if (!cancelled) setProblems(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the system design catalog.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => (problems ?? []).filter((p) => matchesFilter(p, filter)), [problems, filter]);

  return (
    <Screen>
      <SectionHeader
        eyebrow="Interactive Track"
        title={`${problems?.length ?? "26"} real interview architectures, built top-down`}
        subtitle="Tap a component, then tap a + slot to place it - starting from a single client and branching down."
      />

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: active ? colors.brand : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.border
              }}
            >
              <Text style={{ color: active ? "#fff" : colors.text, fontSize: fontSize.sm, fontWeight: "700" }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <ErrorText text={error} /> : null}
      {!problems && !error ? <LoadingView label="Loading the system design catalog..." /> : null}
      {problems && filtered.length === 0 ? <EmptyState text="No problems found for this filter." /> : null}

      {filtered.map((problem) => (
        <Card key={problem.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md, flex: 1 }}>{problem.title}</Text>
            <Pill label={problem.difficulty} tone={difficultyTone(problem.difficulty)} />
          </View>
          <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>{problem.summary}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {problem.companies.map((company) => (
              <Pill key={company} label={company} tone="muted" />
            ))}
            {problem.tags.slice(0, 3).map((tag) => (
              <Pill key={tag} label={tag} tone="brand" />
            ))}
          </View>
          <PrimaryButton label="Design It" icon={<Network color="#fff" size={14} />} onPress={() => navigation.navigate("SystemDesignSolve", { problemId: problem.id })} />
        </Card>
      ))}
    </Screen>
  );
}
