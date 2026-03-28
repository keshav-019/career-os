import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Calculator, ChevronDown, ChevronUp, Clock3, RotateCcw, Scale, ShieldAlert, Sparkles } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import {
  checkSystemDesignEstimate,
  checkSystemDesignFailureQuiz,
  checkSystemDesignTradeoff,
  getSystemDesignProblem,
  getSystemDesignSolution,
  validateSystemDesignPlacement
} from "../../lib/systemDesignClient";
import { COMPONENT_BY_ID, type ComponentCategory } from "../../lib/systemDesignComponents";
import type {
  EstimateResponse,
  FailureQuizResponse,
  SystemDesignProblemDetail,
  SystemDesignSolution,
  TradeoffResponse
} from "../../types/systemDesign";
import type { WarRoomStackParamList } from "../../navigation/types";
import { Card, ErrorText, GhostButton, LoadingView, Pill, ProgressBar, Screen, SectionHeader, TextField } from "../../components/ui/Primitives";

type Props = NativeStackScreenProps<WarRoomStackParamList, "SystemDesignSolve">;

type PlacedNode = { id: string; parentId: string };
type LastMessage = { type: "success" | "error"; text: string; whyItFits?: string };

function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = 0;
  for (let i = 0; i < seed.length; i++) state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildChildrenMap(nodes: PlacedNode[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of nodes) {
    const list = map.get(node.parentId) ?? [];
    list.push(node.id);
    map.set(node.parentId, list);
  }
  return map;
}

const CATEGORY_COLOR: Record<ComponentCategory, string> = {
  edge: "#c1652f",
  compute: "#7c5cff",
  data: "#1f9d73",
  messaging: "#d4a017",
  coordination: "#6b7280"
};

export default function SystemDesignSolveScreen({ route, navigation }: Props) {
  const { problemId } = route.params;
  const { colors, fontSize } = useTheme();

  const [problem, setProblem] = useState<SystemDesignProblemDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [placedNodes, setPlacedNodes] = useState<PlacedNode[]>([]);
  const [armedComponentId, setArmedComponentId] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<LastMessage | null>(null);
  const [validating, setValidating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [solution, setSolution] = useState<SystemDesignSolution | null>(null);
  const [showingSolution, setShowingSolution] = useState(false);
  const [loadingSolution, setLoadingSolution] = useState(false);

  const [estimateAnswers, setEstimateAnswers] = useState<Record<string, string>>({});
  const [estimateResults, setEstimateResults] = useState<EstimateResponse | null>(null);
  const [estimateChecking, setEstimateChecking] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimatePanelOpen, setEstimatePanelOpen] = useState(false);

  const [activeTradeoffNodeId, setActiveTradeoffNodeId] = useState<string | null>(null);
  const [tradeoffSelectedId, setTradeoffSelectedId] = useState<string | null>(null);
  const [tradeoffResult, setTradeoffResult] = useState<TradeoffResponse | null>(null);
  const [tradeoffChecking, setTradeoffChecking] = useState(false);
  const [answeredTradeoffNodeIds, setAnsweredTradeoffNodeIds] = useState<Set<string>>(new Set());

  const [failureAnswers, setFailureAnswers] = useState<Record<string, string>>({});
  const [failureResults, setFailureResults] = useState<FailureQuizResponse | null>(null);
  const [failureChecking, setFailureChecking] = useState(false);
  const [failureError, setFailureError] = useState<string | null>(null);

  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    getSystemDesignProblem(problemId)
      .then((detail) => {
        if (!cancelled) setProblem(detail);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load this problem.");
      });
    return () => {
      cancelled = true;
    };
  }, [problemId]);

  const paletteIds = useMemo(() => (problem ? seededShuffle([...problem.componentIds, ...problem.distractorIds], problem.id) : []), [problem]);
  const placedIdSet = useMemo(() => new Set(placedNodes.map((n) => n.id)), [placedNodes]);
  const childrenMap = useMemo(() => buildChildrenMap(placedNodes), [placedNodes]);
  const total = problem?.totalNodeCount ?? 0;
  const completed = total > 0 && placedNodes.length >= total;

  useEffect(() => {
    if (completedAt !== null) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [completedAt]);

  useEffect(() => {
    if (!completed || completedAt !== null) return;
    setCompletedAt(Date.now());
  }, [completed, completedAt]);

  useEffect(() => {
    if (!completed || !problem || solution) return;
    let cancelled = false;
    setLoadingSolution(true);
    getSystemDesignSolution(problem.id)
      .then((result) => {
        if (!cancelled) setSolution(result);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingSolution(false);
      });
    return () => {
      cancelled = true;
    };
  }, [completed, problem, solution]);

  const elapsedMs = (completedAt ?? nowTick) - startedAt;
  const estimateResultById = useMemo(() => new Map((estimateResults?.results ?? []).map((e) => [e.questionId, e])), [estimateResults]);
  const failureResultById = useMemo(() => new Map((failureResults?.results ?? []).map((e) => [e.questionId, e])), [failureResults]);
  const activeTradeoff = useMemo(
    () => (activeTradeoffNodeId ? problem?.tradeoffs.find((t) => t.nodeId === activeTradeoffNodeId) ?? null : null),
    [activeTradeoffNodeId, problem]
  );

  function handleReset() {
    setPlacedNodes([]);
    setArmedComponentId(null);
    setLastMessage(null);
    setActionError(null);
    setSolution(null);
    setShowingSolution(false);
    setEstimateAnswers({});
    setEstimateResults(null);
    setEstimateError(null);
    setActiveTradeoffNodeId(null);
    setTradeoffSelectedId(null);
    setTradeoffResult(null);
    setAnsweredTradeoffNodeIds(new Set());
    setFailureAnswers({});
    setFailureResults(null);
    setFailureError(null);
    setStartedAt(Date.now());
    setCompletedAt(null);
    setNowTick(Date.now());
  }

  async function attemptPlacement(parentId: string, componentId: string) {
    if (!problem || validating || completed || !componentId) return;
    setValidating(true);
    setActionError(null);
    try {
      const result = await validateSystemDesignPlacement(problem.id, {
        parentComponentId: parentId,
        attemptedComponentId: componentId,
        placedComponentIds: placedNodes.map((n) => n.id)
      });
      if (result.correct) {
        setPlacedNodes((prev) => [...prev, { id: componentId, parentId }]);
        setLastMessage({ type: "success", text: result.message, whyItFits: result.whyItFits });
        setArmedComponentId(null);
        const tradeoff = problem.tradeoffs.find((t) => t.nodeId === componentId);
        if (tradeoff && !answeredTradeoffNodeIds.has(componentId)) {
          setActiveTradeoffNodeId(componentId);
          setTradeoffSelectedId(null);
          setTradeoffResult(null);
        }
      } else {
        setLastMessage({ type: "error", text: result.message });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not check that placement.");
    } finally {
      setValidating(false);
    }
  }

  async function handleCheckEstimates() {
    if (!problem) return;
    const answers = problem.estimationQuestions
      .map((q) => ({ questionId: q.id, raw: estimateAnswers[q.id] ?? "" }))
      .filter((e) => e.raw.trim() !== "")
      .map((e) => ({ questionId: e.questionId, value: Number(e.raw) }))
      .filter((e) => Number.isFinite(e.value));
    if (answers.length === 0) return;
    setEstimateChecking(true);
    setEstimateError(null);
    try {
      setEstimateResults(await checkSystemDesignEstimate(problem.id, { answers }));
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : "Could not check your estimates.");
    } finally {
      setEstimateChecking(false);
    }
  }

  async function handleTradeoffAnswer(optionId: string) {
    if (!problem || !activeTradeoffNodeId || tradeoffChecking || tradeoffResult) return;
    setTradeoffChecking(true);
    setTradeoffSelectedId(optionId);
    try {
      setTradeoffResult(await checkSystemDesignTradeoff(problem.id, { nodeId: activeTradeoffNodeId, optionId }));
    } catch {
      // bonus checkpoint - fail silently
    } finally {
      setTradeoffChecking(false);
    }
  }

  function dismissTradeoff() {
    if (activeTradeoffNodeId) setAnsweredTradeoffNodeIds((prev) => new Set(prev).add(activeTradeoffNodeId));
    setActiveTradeoffNodeId(null);
    setTradeoffSelectedId(null);
    setTradeoffResult(null);
  }

  async function handleCheckFailureQuiz() {
    if (!problem) return;
    const answers = problem.failureQuestions.filter((q) => failureAnswers[q.id]).map((q) => ({ questionId: q.id, optionId: failureAnswers[q.id] }));
    if (answers.length < problem.failureQuestions.length) return;
    setFailureChecking(true);
    setFailureError(null);
    try {
      setFailureResults(await checkSystemDesignFailureQuiz(problem.id, { answers }));
    } catch (err) {
      setFailureError(err instanceof Error ? err.message : "Could not check your answers.");
    } finally {
      setFailureChecking(false);
    }
  }

  if (loadError) {
    return (
      <Screen>
        <ErrorText text={loadError} />
        <GhostButton label="Back to War Room" icon={<ArrowLeft color={colors.text} size={14} />} onPress={() => navigation.popToTop()} />
      </Screen>
    );
  }

  if (!problem) {
    return (
      <Screen>
        <LoadingView label="Loading problem..." />
      </Screen>
    );
  }

  const rootId = problem.rootComponentId;
  const isReadOnly = showingSolution && Boolean(solution);
  const displayChildrenMap = isReadOnly && solution
    ? buildChildrenMap(solution.nodes.map((n) => ({ id: n.componentId, parentId: n.parentComponentId ?? rootId })))
    : childrenMap;
  const whyItFitsById = solution ? new Map(solution.nodes.map((n) => [n.componentId, n.whyItFits])) : undefined;

  function renderNode(nodeId: string, depth: number): ReactNode {
    const component = COMPONENT_BY_ID[nodeId];
    const kids = displayChildrenMap.get(nodeId) ?? [];
    const showAddSlot = !isReadOnly && !completed;
    return (
      <View key={nodeId} style={{ marginLeft: depth * 16, gap: 6, marginTop: 6 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderWidth: depth === 0 ? 1.5 : 1,
            borderColor: depth === 0 ? colors.brand : colors.border
          }}
        >
          {component ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CATEGORY_COLOR[component.category] }} /> : null}
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }}>{component?.label ?? nodeId}</Text>
        </View>
        {isReadOnly && whyItFitsById?.has(nodeId) ? (
          <Text style={{ color: colors.muted, fontSize: 11, marginLeft: 14, maxWidth: 260 }}>{whyItFitsById.get(nodeId)}</Text>
        ) : null}
        {kids.map((kidId) => renderNode(kidId, depth + 1))}
        {showAddSlot ? (
          <Pressable
            onPress={() => {
              if (armedComponentId) void attemptPlacement(nodeId, armedComponentId);
            }}
            style={{
              marginLeft: 16,
              width: 34,
              height: 34,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: armedComponentId ? colors.brand : colors.border,
              backgroundColor: armedComponentId ? `${colors.brand}18` : "transparent"
            }}
          >
            <Text style={{ color: armedComponentId ? colors.brand : colors.muted, fontWeight: "800" }}>+</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <GhostButton label="Back" icon={<ArrowLeft color={colors.text} size={14} />} onPress={() => navigation.goBack()} />
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pill label={problem.difficulty} tone={problem.difficulty === "easy" ? "success" : problem.difficulty === "medium" ? "warning" : "danger"} />
        </View>
      </View>

      <Card>
        <SectionHeader title={problem.title} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {problem.tags.map((tag) => (
            <Pill key={tag} label={tag} tone="muted" />
          ))}
        </View>
        <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm, lineHeight: 20 }}>{problem.statement}</Text>
        <Text style={{ color: colors.text, fontWeight: "800", marginTop: 4 }}>Functional requirements</Text>
        {problem.functionalRequirements.map((req) => (
          <Text key={req} style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>
            - {req}
          </Text>
        ))}
        <Text style={{ color: colors.text, fontWeight: "800", marginTop: 4 }}>Non-functional requirements</Text>
        {problem.nonFunctionalRequirements.map((req) => (
          <Text key={req} style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>
            - {req}
          </Text>
        ))}
        {problem.scaleNote ? (
          <>
            <Text style={{ color: colors.text, fontWeight: "800", marginTop: 4 }}>Scale</Text>
            <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>{problem.scaleNote}</Text>
          </>
        ) : null}
      </Card>

      {!isReadOnly && problem.estimationQuestions.length > 0 ? (
        <Card>
          <Pressable onPress={() => setEstimatePanelOpen((v) => !v)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Calculator color={colors.text} size={14} />
              <Text style={{ color: colors.text, fontWeight: "800" }}>Back-of-envelope estimates</Text>
            </View>
            {estimatePanelOpen ? <ChevronUp color={colors.muted} size={16} /> : <ChevronDown color={colors.muted} size={16} />}
          </Pressable>
          {estimatePanelOpen ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>Ballpark these before you design - the numbers should shape which components you reach for.</Text>
              {problem.estimationQuestions.map((question) => {
                const result = estimateResultById.get(question.id);
                return (
                  <View key={question.id} style={{ gap: 4 }}>
                    <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: "600" }}>{question.prompt}</Text>
                    <TextField
                      value={estimateAnswers[question.id] ?? ""}
                      onChangeText={(v) => setEstimateAnswers((prev) => ({ ...prev, [question.id]: v }))}
                      placeholder={question.placeholder}
                      keyboardType="decimal-pad"
                    />
                    {result ? (
                      <Text style={{ color: result.withinRange ? colors.success : colors.warning, fontSize: 11 }}>
                        {result.withinRange ? "Reasonable ballpark." : `Expected roughly ${result.expectedRangeLabel}.`} {result.explanation}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
              {estimateError ? <ErrorText text={estimateError} /> : null}
              <GhostButton label={estimateChecking ? "Checking..." : "Check my estimates"} icon={<Calculator color={colors.text} size={13} />} onPress={() => void handleCheckEstimates()} disabled={estimateChecking} />
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <ProgressBar percentage={total > 0 ? Math.round((placedNodes.length / total) * 100) : 0} tone="brand" />
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{placedNodes.length} / {total} placed</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Clock3 color={colors.muted} size={13} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>{formatElapsed(elapsedMs)}</Text>
          </View>
          <GhostButton label="Reset" icon={<RotateCcw color={colors.text} size={13} />} onPress={handleReset} />
          {solution ? (
            <GhostButton
              label={showingSolution ? "My design" : "View solution"}
              icon={<Sparkles color={colors.text} size={13} />}
              onPress={() => setShowingSolution((v) => !v)}
            />
          ) : null}
        </View>

        {actionError ? <ErrorText text={actionError} /> : null}

        {lastMessage && !isReadOnly ? (
          <Text style={{ color: lastMessage.type === "success" ? colors.success : colors.danger, fontSize: fontSize.sm }}>
            {lastMessage.text}
            {lastMessage.whyItFits ? ` ${lastMessage.whyItFits}` : ""}
          </Text>
        ) : null}

        {activeTradeoff && !isReadOnly ? (
          <View style={{ gap: 8, backgroundColor: colors.surfaceMuted, borderRadius: 10, padding: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Scale color={colors.text} size={13} />
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 11, textTransform: "uppercase" }}>Design decision</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{activeTradeoff.prompt}</Text>
            {activeTradeoff.options.map((option) => {
              const isSelected = tradeoffSelectedId === option.id;
              const showCorrect = tradeoffResult && isSelected && tradeoffResult.correct;
              const showIncorrect = tradeoffResult && isSelected && !tradeoffResult.correct;
              return (
                <Pressable
                  key={option.id}
                  disabled={Boolean(tradeoffResult) || tradeoffChecking}
                  onPress={() => void handleTradeoffAnswer(option.id)}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: showCorrect ? colors.success : showIncorrect ? colors.danger : colors.border,
                    backgroundColor: colors.surface
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{option.label}</Text>
                </Pressable>
              );
            })}
            {tradeoffResult ? (
              <View style={{ gap: 4 }}>
                <Text style={{ color: tradeoffResult.correct ? colors.success : colors.warning, fontSize: fontSize.sm }}>
                  {tradeoffResult.correct ? "Right call - " : "Not quite - "}
                  {tradeoffResult.chosenRationale}
                </Text>
                {!tradeoffResult.correct ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Better: {tradeoffResult.correctLabel} - {tradeoffResult.correctRationale}
                  </Text>
                ) : null}
                <GhostButton label="Continue designing" onPress={dismissTradeoff} />
              </View>
            ) : null}
          </View>
        ) : null}

        {completed && !isReadOnly ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>Design complete</Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>Every component is in its right place - here's the whole design walked through, step by step.</Text>
            {loadingSolution ? <LoadingView label="Loading the debrief..." /> : null}
            {solution ? (
              <View style={{ gap: 8 }}>
                {solution.nodes.map((node, index) => {
                  const parentId = node.parentComponentId ?? solution.rootComponentId;
                  const parentLabel = COMPONENT_BY_ID[parentId]?.label ?? parentId;
                  const nodeLabel = COMPONENT_BY_ID[node.componentId]?.label ?? node.componentId;
                  return (
                    <View key={node.componentId} style={{ flexDirection: "row", gap: 8 }}>
                      <Text style={{ color: colors.brand, fontWeight: "800" }}>{index + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: "700" }}>
                          {parentLabel} {"→"} {nodeLabel}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>{node.whyItFits}</Text>
                      </View>
                    </View>
                  );
                })}
                <Text style={{ color: colors.text, fontWeight: "800", marginTop: 4 }}>TL;DR</Text>
                {solution.keyTakeaways.map((takeaway) => (
                  <Text key={takeaway} style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>
                    - {takeaway}
                  </Text>
                ))}
              </View>
            ) : null}

            {problem.failureQuestions.length > 0 ? (
              <View style={{ gap: 10, marginTop: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <ShieldAlert color={colors.text} size={13} />
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 11, textTransform: "uppercase" }}>Bottleneck & failure check</Text>
                </View>
                {problem.failureQuestions.map((question) => {
                  const result = failureResultById.get(question.id);
                  return (
                    <View key={question.id} style={{ gap: 6 }}>
                      <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{question.prompt}</Text>
                      {question.options.map((option) => {
                        const isSelected = failureAnswers[question.id] === option.id;
                        const isCorrectOne = result?.correctOptionId === option.id;
                        const revealCorrect = Boolean(result) && isCorrectOne;
                        const revealWrong = Boolean(result) && isSelected && !isCorrectOne;
                        return (
                          <Pressable
                            key={option.id}
                            disabled={Boolean(failureResults)}
                            onPress={() => !failureResults && setFailureAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: revealCorrect ? colors.success : revealWrong ? colors.danger : isSelected ? colors.brand : colors.border,
                              backgroundColor: colors.surface
                            }}
                          >
                            <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{option.label}</Text>
                          </Pressable>
                        );
                      })}
                      {result ? <Text style={{ color: colors.muted, fontSize: 11 }}>{result.explanation}</Text> : null}
                    </View>
                  );
                })}
                {failureError ? <ErrorText text={failureError} /> : null}
                {!failureResults ? (
                  <GhostButton
                    label={failureChecking ? "Checking..." : "Check answers"}
                    icon={<ShieldAlert color={colors.text} size={13} />}
                    onPress={() => void handleCheckFailureQuiz()}
                    disabled={failureChecking || Object.keys(failureAnswers).length < problem.failureQuestions.length}
                  />
                ) : (
                  <Text style={{ color: colors.success, fontSize: fontSize.sm, fontWeight: "700" }}>
                    {failureResults.results.filter((r) => r.correct).length} / {failureResults.results.length} correct
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        <View>{renderNode(rootId, 0)}</View>
      </Card>

      <Card>
        <SectionHeader eyebrow="Component Palette" title={isReadOnly ? "Annotated solution" : "Tap a chip, then tap a + slot"} />
        {isReadOnly ? (
          <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>You're viewing the annotated solution. Toggle back to your own design from above to keep placing components.</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {paletteIds.map((componentId) => {
              const component = COMPONENT_BY_ID[componentId];
              const used = placedIdSet.has(componentId);
              const armed = armedComponentId === componentId;
              return (
                <Pressable
                  key={componentId}
                  disabled={used}
                  onPress={() => setArmedComponentId((current) => (current === componentId ? null : componentId))}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: armed ? colors.brand : colors.border,
                    backgroundColor: used ? colors.surfaceMuted : armed ? `${colors.brand}18` : colors.surface,
                    opacity: used ? 0.4 : 1
                  }}
                >
                  {component ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: CATEGORY_COLOR[component.category] }} /> : null}
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{component?.label ?? componentId}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>
    </Screen>
  );
}
