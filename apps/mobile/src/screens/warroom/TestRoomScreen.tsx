import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AlertTriangle, ArrowLeft, Check, Save, Timer, X } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import {
  savePracticeAttemptProgress,
  startPracticeAttempt,
  submitPracticeAttempt,
  usePracticeAttempt
} from "../../lib/practiceAttempts";
import { fetchMcqReview } from "../../lib/practiceAttempts";
import { hasDesktopOnlyExecution, type McqReviewEntry, type PracticeQuestion } from "../../types/practiceAttempt";
import type { WarRoomStackParamList } from "../../navigation/types";
import {
  Card,
  ErrorText,
  GhostButton,
  LoadingView,
  Pill,
  PrimaryButton,
  ProgressBar,
  Screen,
  SectionHeader,
  TextField
} from "../../components/ui/Primitives";
import { SwitchRow } from "../../components/ui/SwitchRow";

type Props = NativeStackScreenProps<WarRoomStackParamList, "TestRoom">;

function formatRemaining(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function questionAnswered(question: PracticeQuestion, mcqAnswers: Record<string, string>, codingCompletion: Record<string, boolean>, codingNotes: Record<string, string>): boolean {
  if (question.kind === "mcq") return Boolean((mcqAnswers[question.id] ?? "").trim());
  return codingCompletion[question.id] === true || Boolean((codingNotes[question.id] ?? "").trim());
}

export default function TestRoomScreen({ route, navigation }: Props) {
  const { attemptId } = route.params;
  const { colors, fontSize } = useTheme();
  const { user } = useAuth();
  const { attempt, loading } = usePracticeAttempt(user?.uid, attemptId);

  const initializedRef = useRef<string | null>(null);
  const autoSubmitGuardRef = useRef<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [codingNotes, setCodingNotes] = useState<Record<string, string>>({});
  const [codingCompletion, setCodingCompletion] = useState<Record<string, boolean>>({});
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [reviews, setReviews] = useState<Record<string, McqReviewEntry> | null>(null);

  useEffect(() => {
    if (!attempt || initializedRef.current === attempt.id) return;
    initializedRef.current = attempt.id;
    autoSubmitGuardRef.current = null;
    setCurrentIndex(attempt.currentQuestionIndex);
    setMcqAnswers(attempt.mcqAnswers);
    setCodingNotes(attempt.codingNotes);
    setCodingCompletion(attempt.codingCompletion);
  }, [attempt]);

  const questions = useMemo(() => attempt?.questions ?? [], [attempt]);
  const questionCount = questions.length;
  const currentQuestion = questions[Math.max(0, Math.min(currentIndex, questionCount - 1))] ?? null;
  const hasStarted = attempt ? attempt.status !== "ready" : false;
  const isSubmitted = attempt ? attempt.status === "submitted" || attempt.status === "timed_out" : false;
  const totalDurationSeconds = (attempt?.durationMinutes ?? 0) * 60;

  const answeredCount = useMemo(
    () => questions.filter((q) => questionAnswered(q, mcqAnswers, codingCompletion, codingNotes)).length,
    [questions, mcqAnswers, codingCompletion, codingNotes]
  );

  const secondsLeft = useMemo(() => {
    if (!attempt) return 0;
    if (!attempt.deadlineAt || !hasStarted) return totalDurationSeconds;
    const deadlineMs = Date.parse(attempt.deadlineAt);
    if (!Number.isFinite(deadlineMs)) return totalDurationSeconds;
    return Math.max(0, Math.round((deadlineMs - clockTick) / 1000));
  }, [attempt, clockTick, hasStarted, totalDurationSeconds]);

  const timerProgress = totalDurationSeconds > 0 ? Math.round(((totalDurationSeconds - secondsLeft) / totalDurationSeconds) * 100) : 0;

  useEffect(() => {
    if (!attempt?.deadlineAt || !hasStarted || isSubmitted) return;
    const interval = setInterval(() => setClockTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [attempt?.deadlineAt, hasStarted, isSubmitted]);

  useEffect(() => {
    if (!attempt || !user || isSubmitted || initializedRef.current !== attempt.id) return;
    const timeout = setTimeout(() => {
      void savePracticeAttemptProgress(user.uid, attempt.id, {
        currentQuestionIndex: currentIndex,
        mcqAnswers,
        codingNotes,
        codingCompletion
      }).catch((err) => setActionError(err instanceof Error ? err.message : "Unable to autosave progress."));
    }, 600);
    return () => clearTimeout(timeout);
  }, [attempt, user, isSubmitted, currentIndex, mcqAnswers, codingNotes, codingCompletion]);

  async function handleSubmit(timedOut = false) {
    if (!attempt || !user || isSubmitting || isSubmitted) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const { reviews: reviewMap } = await submitPracticeAttempt(user.uid, attempt, {
        currentQuestionIndex: currentIndex,
        mcqAnswers,
        codingNotes,
        codingCompletion,
        timedOut
      });
      setReviews(reviewMap);
      setShowSubmitModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to submit test.");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    if (secondsLeft > 0 || isSubmitting) return;
    if (autoSubmitGuardRef.current === attempt.id) return;
    autoSubmitGuardRef.current = attempt.id;
    void handleSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, secondsLeft, isSubmitting]);

  useEffect(() => {
    if (!attempt || !isSubmitted || reviews) return;
    const mcqIds = questions.filter((q) => q.kind === "mcq").map((q) => q.id);
    if (mcqIds.length === 0) {
      setReviews({});
      return;
    }
    fetchMcqReview(mcqIds, attempt.mcqAnswers)
      .then((result) => setReviews(result.reviews))
      .catch(() => setReviews({}));
  }, [attempt, isSubmitted, questions, reviews]);

  async function handleStart() {
    if (!attempt || !user) return;
    setActionError(null);
    setIsStarting(true);
    try {
      await startPracticeAttempt(user.uid, attempt);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to start this test.");
    } finally {
      setIsStarting(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingView label="Loading attempt..." />
      </Screen>
    );
  }

  if (!attempt) {
    return (
      <Screen>
        <ErrorText text="This attempt could not be loaded." />
        <GhostButton label="Back to War Room" icon={<ArrowLeft color={colors.text} size={14} />} onPress={() => navigation.popToTop()} />
      </Screen>
    );
  }

  if (questions.length === 0) {
    return (
      <Screen>
        <ErrorText text="This attempt is missing question data. Start a new test from Interview War Room." />
        <GhostButton label="Back to War Room" icon={<ArrowLeft color={colors.text} size={14} />} onPress={() => navigation.popToTop()} />
      </Screen>
    );
  }

  if (!hasStarted) {
    return (
      <Screen>
        {actionError ? <ErrorText text={actionError} /> : null}
        <Card highlight>
          <SectionHeader eyebrow="Ready To Start" title={attempt.title} subtitle={attempt.subtitle} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pill label={`${attempt.durationMinutes} minutes`} tone="brand" />
            <Pill label={`${attempt.questionCount} questions`} tone="muted" />
          </View>
          <Text style={{ color: colors.muted, fontSize: fontSize.sm, lineHeight: 19 }}>
            Progress autosaves continuously. When the timer hits zero, your test submits automatically.
          </Text>
          {hasDesktopOnlyExecution(attempt.mode) ? (
            <Text style={{ color: colors.warning, fontSize: fontSize.sm, lineHeight: 19 }}>
              Coding execution is desktop-only for now. You can read problems and keep notes here while solving on desktop.
            </Text>
          ) : null}
          <PrimaryButton label={isStarting ? "Starting..." : "Start Test"} onPress={() => void handleStart()} loading={isStarting} />
        </Card>
      </Screen>
    );
  }

  if (isSubmitted) {
    const score = attempt.score ?? { total: 0, correct: 0, answered: 0, percentage: 0 };
    return (
      <Screen>
        <Card highlight>
          <SectionHeader eyebrow="Result Summary" title={attempt.status === "timed_out" ? "Time ended" : "Submission complete"} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pill label={`Answered ${score.answered}/${score.total || attempt.questionCount}`} tone="brand" />
            <Pill label={`Score ${score.total > 0 ? `${score.percentage}%` : "N/A"}`} tone={score.percentage >= 60 ? "success" : "warning"} />
          </View>
          {score.total > 0 ? <ProgressBar percentage={score.percentage} tone={score.percentage >= 60 ? "success" : "warning"} /> : null}
        </Card>

        <Card>
          <SectionHeader eyebrow="Question Review" title="Attempt breakdown" />
          {questions.map((question, index) => {
            if (question.kind === "mcq") {
              const selected = (mcqAnswers[question.id] ?? "").toLowerCase();
              const review = reviews?.[question.id];
              const isCorrect = Boolean(review) && selected !== "" && selected === review!.correctOptionId;
              return (
                <View key={question.id} style={{ gap: 4, paddingVertical: 8, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm, flex: 1 }}>
                      Q{index + 1}. {question.category}
                    </Text>
                    <Pill label={selected === "" ? "Not answered" : isCorrect ? "Correct" : "Incorrect"} tone={selected === "" ? "warning" : isCorrect ? "success" : "danger"} />
                  </View>
                  <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>{question.prompt}</Text>
                  {review ? (
                    <>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        Selected: {selected ? selected.toUpperCase() : "-"} / Correct: {review.correctOptionId.toUpperCase()}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{review.explanation}</Text>
                    </>
                  ) : null}
                </View>
              );
            }
            return (
              <View key={question.id} style={{ gap: 4, paddingVertical: 8, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm, flex: 1 }}>
                    Q{index + 1}. {question.category} ({question.difficulty})
                  </Text>
                  <Pill label={codingCompletion[question.id] ? "Marked complete" : "Not marked complete"} tone={codingCompletion[question.id] ? "success" : "warning"} />
                </View>
                <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>{question.prompt}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Notes: {(codingNotes[question.id] ?? "").trim() || "No notes provided"}</Text>
              </View>
            );
          })}
        </Card>

        <GhostButton label="Back to War Room" icon={<ArrowLeft color={colors.text} size={14} />} onPress={() => navigation.popToTop()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {actionError ? <ErrorText text={actionError} /> : null}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.lg }}>{attempt.title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Timer color={colors.brand} size={15} />
          <Text style={{ color: colors.text, fontWeight: "800" }}>{formatRemaining(secondsLeft)}</Text>
        </View>
      </View>
      <ProgressBar percentage={timerProgress} tone="brand" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {questions.map((question, index) => {
          const answered = questionAnswered(question, mcqAnswers, codingCompletion, codingNotes);
          const active = index === currentIndex;
          return (
            <Pressable
              key={question.id}
              onPress={() => setCurrentIndex(index)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? colors.brand : answered ? `${colors.success}33` : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.border
              }}
            >
              <Text style={{ color: active ? "#fff" : colors.text, fontSize: 12, fontWeight: "700" }}>{String(index + 1).padStart(2, "0")}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {currentQuestion ? (
        <Card>
          <SectionHeader
            eyebrow={`Question ${currentIndex + 1} of ${questionCount}`}
            title={currentQuestion.category}
            right={<Pill label={currentQuestion.kind.toUpperCase()} tone={currentQuestion.kind === "coding" ? "warning" : "brand"} />}
          />
          <Text style={{ color: colors.text, fontSize: fontSize.base, lineHeight: 21 }}>{currentQuestion.prompt}</Text>

          {currentQuestion.kind === "mcq" ? (
            <View style={{ gap: 8 }}>
              {currentQuestion.options.map((option) => {
                const selected = (mcqAnswers[currentQuestion.id] ?? "").toLowerCase() === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setMcqAnswers((current) => ({ ...current, [currentQuestion.id]: option.id }))}
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "center",
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: selected ? colors.brand : colors.border,
                      backgroundColor: selected ? `${colors.brand}18` : colors.surface
                    }}
                  >
                    <Text style={{ color: selected ? colors.brand : colors.muted, fontWeight: "800" }}>{option.id.toUpperCase()}</Text>
                    <Text style={{ color: colors.text, flex: 1, fontSize: fontSize.sm }}>{option.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>Input Format</Text>
              <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>{currentQuestion.inputFormat}</Text>
              <Text style={{ color: colors.text, fontWeight: "700" }}>Output Format</Text>
              <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>{currentQuestion.outputFormat}</Text>
              {currentQuestion.constraints.length > 0 ? (
                <>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Constraints</Text>
                  {currentQuestion.constraints.map((constraint) => (
                    <Text key={constraint} style={{ color: colors.mutedStrong, fontSize: fontSize.sm }}>
                      - {constraint}
                    </Text>
                  ))}
                </>
              ) : null}
              <Text style={{ color: colors.text, fontWeight: "700" }}>Sample Input</Text>
              <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm, fontFamily: "monospace" }}>{currentQuestion.sampleInput || "N/A"}</Text>
              <Text style={{ color: colors.text, fontWeight: "700" }}>Sample Output</Text>
              <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm, fontFamily: "monospace" }}>{currentQuestion.sampleOutput || "N/A"}</Text>
              <TextField
                label="Solution notes / approach"
                value={codingNotes[currentQuestion.id] ?? ""}
                onChangeText={(v) => setCodingNotes((current) => ({ ...current, [currentQuestion.id]: v }))}
                placeholder="Write your approach, complexity, and edge cases while solving on desktop."
                multiline
                numberOfLines={6}
              />
              <SwitchRow
                title="Mark as solved on desktop"
                value={codingCompletion[currentQuestion.id] === true}
                onValueChange={(v) => setCodingCompletion((current) => ({ ...current, [currentQuestion.id]: v }))}
              />
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <GhostButton label="Previous" onPress={() => setCurrentIndex((v) => Math.max(0, v - 1))} disabled={currentIndex <= 0} />
            <GhostButton label="Next" onPress={() => setCurrentIndex((v) => Math.min(questionCount - 1, v + 1))} disabled={currentIndex >= questionCount - 1} />
            <PrimaryButton label="Submit Test" icon={<AlertTriangle color="#fff" size={14} />} onPress={() => setShowSubmitModal(true)} />
          </View>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
        <Save color={colors.muted} size={11} />
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          {answeredCount}/{questionCount} answered
        </Text>
      </View>

      <Modal visible={showSubmitModal} transparent animationType="fade" onRequestClose={() => setShowSubmitModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 18, gap: 12 }}>
            <SectionHeader eyebrow="Confirm Submission" title="Submit this test now?" subtitle={`You have answered ${answeredCount} of ${questionCount} questions.`} />
            <Text style={{ color: colors.warning, fontSize: fontSize.sm }}>Once submitted, the attempt moves to review mode and the timer stops.</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <GhostButton label="Continue Test" icon={<X color={colors.text} size={14} />} onPress={() => setShowSubmitModal(false)} />
              <PrimaryButton label="Confirm Submit" icon={<Check color="#fff" size={14} />} onPress={() => void handleSubmit(false)} loading={isSubmitting} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
