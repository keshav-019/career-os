"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Check,
  Code2,
  Expand,
  FileWarning,
  Loader2,
  Save,
  ShieldCheck,
  Timer,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  savePracticeAttemptProgress,
  startPracticeAttempt,
  submitPracticeAttempt,
  usePracticeAttempt
} from "@/lib/firebase/interview-war-room";
import {
  formatInterviewTestType,
  getMcqQuestionById,
  hasDesktopOnlyExecution,
  type PracticeQuestion
} from "@/lib/interview/question-bank";
import { sanitizeExternalUrl } from "@/lib/url-safety";

function formatRemainingTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "Not available";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "Not available";
  }

  return new Date(parsed).toLocaleString();
}

function statusLabel(status: string): string {
  if (status === "in_progress") {
    return "In Progress";
  }

  if (status === "submitted") {
    return "Submitted";
  }

  if (status === "timed_out") {
    return "Timed Out";
  }

  return "Ready";
}

function statusTone(status: string): string {
  if (status === "submitted") {
    return "success";
  }

  if (status === "timed_out") {
    return "danger";
  }

  if (status === "in_progress") {
    return "brand";
  }

  return "warning";
}

function questionAnswered(
  question: PracticeQuestion,
  mcqAnswers: Record<string, string>,
  codingCompletion: Record<string, boolean>,
  codingNotes: Record<string, string>
): boolean {
  if (question.kind === "mcq") {
    return Boolean((mcqAnswers[question.id] ?? "").trim());
  }

  if (codingCompletion[question.id] === true) {
    return true;
  }

  return Boolean((codingNotes[question.id] ?? "").trim());
}

type QuestionOutcome = {
  answered: boolean;
  earned: number;
  total: number;
};

type TopicSubtopicBreakdownRow = {
  earned: number;
  key: string;
  percentage: number;
  subtopic: string;
  topic: string;
  total: number;
};

function scoreQuestionOutcome(
  question: PracticeQuestion,
  mcqAnswers: Record<string, string>,
  codingCompletion: Record<string, boolean>,
  codingNotes: Record<string, string>
): QuestionOutcome {
  if (question.kind === "mcq") {
    const selected = (mcqAnswers[question.id] ?? "").trim().toLowerCase();
    const canonical = getMcqQuestionById(question.id);
    const answered = selected.length > 0;
    const earned = canonical && answered && selected === canonical.correctOptionId ? 1 : 0;

    return {
      answered,
      earned,
      total: 1
    };
  }

  const markedComplete = codingCompletion[question.id] === true;
  const hasNotes = (codingNotes[question.id] ?? "").trim().length > 0;

  return {
    answered: markedComplete || hasNotes,
    earned: markedComplete ? 1 : 0,
    total: 1
  };
}

function percentageFromMarks(earned: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.round((earned / total) * 100);
}

export default function TestRoomAttemptPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = typeof params?.attemptId === "string" ? params.attemptId : "";
  const { attempt, error, loading, user } = usePracticeAttempt(attemptId);

  const initializedAttemptRef = useRef<string | null>(null);
  const autoSubmitGuardRef = useRef<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [codingNotes, setCodingNotes] = useState<Record<string, string>>({});
  const [codingCompletion, setCodingCompletion] = useState<Record<string, boolean>>({});
  const [clockTickMs, setClockTickMs] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    if (!attempt) {
      return;
    }

    if (initializedAttemptRef.current === attempt.id) {
      return;
    }

    initializedAttemptRef.current = attempt.id;
    autoSubmitGuardRef.current = null;
    setCurrentIndex(attempt.currentQuestionIndex);
    setMcqAnswers(attempt.mcqAnswers);
    setCodingNotes(attempt.codingNotes);
    setCodingCompletion(attempt.codingCompletion);
  }, [attempt]);

  const questions = useMemo(() => attempt?.questions ?? [], [attempt]);
  const questionCount = questions.length;
  const currentQuestion = questions[Math.max(0, Math.min(currentIndex, questionCount - 1))] ?? null;
  const currentQuestionImageUrl = currentQuestion ? sanitizeExternalUrl(currentQuestion.imageUrl) : null;
  const currentQuestionImageSourceUrl = currentQuestion ? sanitizeExternalUrl(currentQuestion.imageSourceUrl) : null;
  const hasStarted = attempt ? attempt.status !== "ready" : false;
  const isSubmitted = attempt ? attempt.status === "submitted" || attempt.status === "timed_out" : false;
  const totalDurationSeconds = (attempt?.durationMinutes ?? 0) * 60;

  const answeredCount = useMemo(
    () => questions.filter((question) => questionAnswered(question, mcqAnswers, codingCompletion, codingNotes)).length,
    [codingCompletion, codingNotes, mcqAnswers, questions]
  );

  const secondsLeft = useMemo(() => {
    if (!attempt) {
      return 0;
    }

    if (!attempt.deadlineAt || !hasStarted) {
      return totalDurationSeconds;
    }

    const deadlineMs = Date.parse(attempt.deadlineAt);
    if (!Number.isFinite(deadlineMs)) {
      return totalDurationSeconds;
    }

    return Math.max(0, Math.round((deadlineMs - clockTickMs) / 1000));
  }, [attempt, clockTickMs, hasStarted, totalDurationSeconds]);

  const timerProgress = useMemo(() => {
    if (totalDurationSeconds <= 0) {
      return 0;
    }

    const elapsed = Math.max(0, totalDurationSeconds - secondsLeft);
    return Math.round((elapsed / totalDurationSeconds) * 100);
  }, [secondsLeft, totalDurationSeconds]);

  const resultSummary = useMemo(() => {
    if (!attempt) {
      return {
        answered: 0,
        earned: 0,
        percentage: 0,
        total: 0
      };
    }

    const score = attempt.score ?? {
      total: 0,
      correct: 0,
      answered: 0,
      percentage: 0
    };

    if (attempt.mode === "mcq" && score.total > 0) {
      return {
        answered: score.answered,
        earned: score.correct,
        total: score.total,
        percentage: score.percentage
      };
    }

    const scored = questions.reduce(
      (aggregate, question) => {
        const outcome = scoreQuestionOutcome(question, mcqAnswers, codingCompletion, codingNotes);
        aggregate.answered += outcome.answered ? 1 : 0;
        aggregate.earned += outcome.earned;
        aggregate.total += outcome.total;
        return aggregate;
      },
      {
        answered: 0,
        earned: 0,
        total: 0
      }
    );

    return {
      ...scored,
      percentage: percentageFromMarks(scored.earned, scored.total)
    };
  }, [attempt, codingCompletion, codingNotes, mcqAnswers, questions]);

  const topicSubtopicRows = useMemo(() => {
    if (!attempt) {
      return [] as TopicSubtopicBreakdownRow[];
    }

    const topic = formatInterviewTestType(attempt.testType);
    const tracker = new Map<string, TopicSubtopicBreakdownRow>();

    questions.forEach((question) => {
      const subtopic = question.category || "General";
      const key = `${topic}::${subtopic}`;
      const outcome = scoreQuestionOutcome(question, mcqAnswers, codingCompletion, codingNotes);
      const tracked = tracker.get(key) ?? {
        key,
        topic,
        subtopic,
        earned: 0,
        total: 0,
        percentage: 0
      };

      tracked.earned += outcome.earned;
      tracked.total += outcome.total;
      tracker.set(key, tracked);
    });

    return [...tracker.values()]
      .map((row) => ({
        ...row,
        percentage: percentageFromMarks(row.earned, row.total)
      }))
      .sort((first, second) => {
        if (second.total !== first.total) {
          return second.total - first.total;
        }

        if (second.percentage !== first.percentage) {
          return second.percentage - first.percentage;
        }

        return first.subtopic.localeCompare(second.subtopic);
      });
  }, [attempt, codingCompletion, codingNotes, mcqAnswers, questions]);

  useEffect(() => {
    if (!attempt?.deadlineAt || !hasStarted || isSubmitted) {
      return;
    }

    const interval = window.setInterval(() => {
      setClockTickMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [attempt?.deadlineAt, hasStarted, isSubmitted]);

  useEffect(() => {
    if (!attempt || !user) {
      return;
    }

    if (attempt.status === "submitted" || attempt.status === "timed_out") {
      return;
    }

    if (initializedAttemptRef.current !== attempt.id) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void savePracticeAttemptProgress(user.uid, attempt.id, questionCount, {
        currentQuestionIndex: currentIndex,
        mcqAnswers,
        codingNotes,
        codingCompletion
      }).catch((saveError) => {
        setActionError(saveError instanceof Error ? saveError.message : "Unable to autosave progress.");
      });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [attempt, codingCompletion, codingNotes, currentIndex, mcqAnswers, questionCount, user]);

  const handleSubmit = useCallback(
    async (timedOut = false) => {
      if (!attempt || !user || isSubmitting || isSubmitted) {
        return;
      }

      setActionError(null);
      setActionNotice(null);
      setIsSubmitting(true);

      try {
        const score = await submitPracticeAttempt(user.uid, attempt, {
          currentQuestionIndex: currentIndex,
          mcqAnswers,
          codingNotes,
          codingCompletion,
          timedOut
        });

        if (typeof document !== "undefined" && document.fullscreenElement) {
          await document.exitFullscreen().catch(() => undefined);
        }

        setActionNotice(
          score.total > 0
            ? `${timedOut ? "Time ended" : "Test submitted"}. Score: ${score.percentage}% (${score.correct}/${score.total}).`
            : timedOut
              ? "Time ended. Coding attempt saved for review."
              : "Test submitted. Coding attempt saved for review."
        );
        setShowSubmitModal(false);
      } catch (submitError) {
        setActionError(submitError instanceof Error ? submitError.message : "Unable to submit test.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [attempt, codingCompletion, codingNotes, currentIndex, isSubmitted, isSubmitting, mcqAnswers, user]
  );

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") {
      return;
    }

    if (secondsLeft > 0 || isSubmitting) {
      return;
    }

    if (autoSubmitGuardRef.current === attempt.id) {
      return;
    }

    autoSubmitGuardRef.current = attempt.id;
    void handleSubmit(true);
  }, [attempt, handleSubmit, isSubmitting, secondsLeft]);

  const handleStart = async () => {
    if (!attempt || !user) {
      return;
    }

    setActionError(null);
    setActionNotice(null);
    setIsStarting(true);

    try {
      if (typeof document !== "undefined" && document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => undefined);
      }

      await startPracticeAttempt(user.uid, attempt);
      setActionNotice("Test started. Timer is running now.");
    } catch (startError) {
      setActionError(startError instanceof Error ? startError.message : "Unable to start this test.");
    } finally {
      setIsStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="test-room-page">
        <section className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Test Room</p>
              <h2>Loading attempt...</h2>
            </div>
            <Loader2 className="spin" size={18} />
          </div>
        </section>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="test-room-page">
        <section className="career-card highlight">
          <div className="card-header">
            <div>
              <p className="eyebrow">Test Room</p>
              <h2>Attempt not available</h2>
              <p>{error ?? "This attempt could not be loaded."}</p>
            </div>
            <FileWarning size={19} />
          </div>
          <Link className="ghost-button" href="/interview-prep">
            <ArrowLeft size={14} /> Back to Interview War Room
          </Link>
        </section>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="test-room-page">
        <section className="career-card">
          <h2>Please sign in to continue this test.</h2>
        </section>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="test-room-page">
        <section className="career-card highlight">
          <div className="card-header">
            <div>
              <p className="eyebrow">Test Room</p>
              <h2>No questions found</h2>
              <p>This attempt is missing question data. Start a new test from Interview War Room.</p>
            </div>
            <AlertTriangle size={18} />
          </div>
          <Link className="ghost-button" href="/interview-prep">
            <ArrowLeft size={14} /> Back to Interview War Room
          </Link>
        </section>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="test-room-page">
        {actionError ? <p className="settings-feedback error">{actionError}</p> : null}
        {actionNotice ? <p className="settings-feedback success">{actionNotice}</p> : null}

        <section className="career-card highlight">
          <div className="card-header">
            <div>
              <p className="eyebrow">Ready To Start</p>
              <h2>{attempt.title}</h2>
              <p>{attempt.subtitle}</p>
            </div>
            {attempt.mode === "coding" ? <Code2 size={20} /> : <BrainCircuit size={20} />}
          </div>

          <div className="test-room-start-grid">
            <div className="test-room-start-item">
              <strong>Status</strong>
              <span className={`pill ${statusTone(attempt.status)}`}>{statusLabel(attempt.status)}</span>
            </div>
            <div className="test-room-start-item">
              <strong>Duration</strong>
              <span>{attempt.durationMinutes} minutes</span>
            </div>
            <div className="test-room-start-item">
              <strong>Questions</strong>
              <span>{attempt.questionCount}</span>
            </div>
            <div className="test-room-start-item">
              <strong>Created</strong>
              <span>{formatDateTime(attempt.createdAt)}</span>
            </div>
          </div>

          <ul className="topic-list" style={{ marginTop: 16 }}>
            <li>
              <strong>Fullscreen recommended</strong>
              <p>Click start and we will request fullscreen before timer starts.</p>
            </li>
            <li>
              <strong>Progress autosaves</strong>
              <p>Your answers and current question index are continuously synced to Firestore.</p>
            </li>
            <li>
              <strong>Auto-submit on timeout</strong>
              <p>When timer hits zero, submission is triggered automatically.</p>
            </li>
          </ul>

          {hasDesktopOnlyExecution(attempt.mode) ? (
            <div className="test-room-desktop-note" style={{ marginTop: 16 }}>
              <FileWarning size={14} />
              <span>
                Coding execution is desktop-only for now. You can still read problems here and keep notes while solving on desktop.
              </span>
            </div>
          ) : null}

          <div className="row-between" style={{ marginTop: 18 }}>
            <Link className="ghost-button" href="/interview-prep">
              <ArrowLeft size={14} /> Back
            </Link>
            <button className="primary-button" disabled={isStarting} onClick={() => void handleStart()} type="button">
              {isStarting ? <Loader2 className="spin" size={14} /> : <Expand size={14} />} Enter Fullscreen & Start
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="test-room-page">
      {actionError ? <p className="settings-feedback error">{actionError}</p> : null}
      {actionNotice ? <p className="settings-feedback success">{actionNotice}</p> : null}

      <section className="test-room-stage">
        <header className="test-room-header">
          <div>
            <p className="eyebrow">Test Room</p>
            <h2>{attempt.title}</h2>
            <p>{attempt.subtitle}</p>
          </div>
          <div className="test-room-header-right">
            <span className={`pill ${statusTone(attempt.status)}`}>{statusLabel(attempt.status)}</span>
            <strong className="test-room-timer">
              <Timer size={15} /> {formatRemainingTime(secondsLeft)}
            </strong>
          </div>
        </header>

        <div className="test-room-progress-track" role="progressbar" aria-valuenow={timerProgress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${timerProgress}%` }} />
        </div>

        {isSubmitted ? (
          <div className="test-room-results">
            <article className="career-card highlight">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Result Summary</p>
                  <h2>{attempt.status === "timed_out" ? "Time ended" : "Submission complete"}</h2>
                  <p>Submitted at {formatDateTime(attempt.submittedAt)}</p>
                </div>
                <ShieldCheck size={20} />
              </div>

              <div className="test-room-start-grid">
                <div className="test-room-start-item">
                  <strong>Answered</strong>
                  <span>
                    {resultSummary.answered}/{resultSummary.total || attempt.questionCount}
                  </span>
                </div>
                <div className="test-room-start-item">
                  <strong>Marks</strong>
                  <span>
                    {resultSummary.earned}/{resultSummary.total || attempt.questionCount}
                  </span>
                </div>
                <div className="test-room-start-item">
                  <strong>Score</strong>
                  <span>{resultSummary.total > 0 ? `${resultSummary.percentage}/100` : "0/100"}</span>
                </div>
                <div className="test-room-start-item">
                  <strong>Mode</strong>
                  <span>{attempt.mode.toUpperCase()}</span>
                </div>
              </div>

              <div className="test-room-result-scoreline">
                <div className="row-between">
                  <strong>Overall score progression</strong>
                  <span>{resultSummary.percentage}%</span>
                </div>
                <div className="test-room-result-scoretrack">
                  <span style={{ width: `${resultSummary.percentage}%` }} />
                </div>
              </div>

              <div className="row-between" style={{ marginTop: 16 }}>
                <Link className="ghost-button" href="/interview-prep">
                  Interview War Room
                </Link>
                <Link className="primary-button" href="/interview-prep">
                  Back to War Room
                </Link>
              </div>
            </article>

            <article className="career-card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Topic Analysis</p>
                  <h2>Topic and subtopic scores</h2>
                  <p>Each row shows marks and a blue progression line for that subtopic.</p>
                </div>
              </div>

              {topicSubtopicRows.length === 0 ? (
                <div className="empty-drop">Attempt data is not available for topic analysis.</div>
              ) : (
                <ul className="test-room-topic-breakdown">
                  {topicSubtopicRows.map((row) => (
                    <li className="test-room-topic-row" key={row.key}>
                      <div className="test-room-topic-head">
                        <div>
                          <strong>{row.subtopic}</strong>
                          <p>{row.topic}</p>
                        </div>
                        <span className="pill brand">
                          {row.earned}/{row.total}
                        </span>
                      </div>
                      <div className="test-room-topic-track" role="progressbar" aria-valuenow={row.percentage} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${row.percentage}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="career-card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Question Review</p>
                  <h2>Attempt breakdown</h2>
                </div>
              </div>

              <ul className="test-room-review-list">
                {questions.map((question, index) => {
                  if (question.kind === "mcq") {
                    const canonical = getMcqQuestionById(question.id);
                    const selected = (mcqAnswers[question.id] ?? "").toLowerCase();
                    const correctOption = canonical?.correctOptionId ?? "";
                    const isCorrect = selected !== "" && selected === correctOption;

                    return (
                      <li className="test-room-review-row" key={question.id}>
                        <div className="row-between">
                          <strong>
                            Q{index + 1}. {question.category}
                          </strong>
                          <span className={`pill ${selected === "" ? "warning" : isCorrect ? "success" : "danger"}`}>
                            {selected === "" ? "Not answered" : isCorrect ? "Correct" : "Incorrect"}
                          </span>
                        </div>
                        <p>{question.prompt}</p>
                        <p className="muted" style={{ marginTop: 4 }}>
                          Selected: {selected ? selected.toUpperCase() : "-"} / Correct: {correctOption ? correctOption.toUpperCase() : "-"}
                        </p>
                        {canonical?.explanation ? (
                          <p className="muted" style={{ marginTop: 4 }}>
                            {canonical.explanation}
                          </p>
                        ) : null}
                      </li>
                    );
                  }

                  return (
                    <li className="test-room-review-row" key={question.id}>
                      <div className="row-between">
                        <strong>
                          Q{index + 1}. {question.category} ({question.difficulty})
                        </strong>
                        <span className={`pill ${codingCompletion[question.id] ? "success" : "warning"}`}>
                          {codingCompletion[question.id] ? "Marked complete" : "Not marked complete"}
                        </span>
                      </div>
                      <p>{question.prompt}</p>
                      <p className="muted" style={{ marginTop: 4 }}>
                        Notes: {(codingNotes[question.id] ?? "").trim() || "No notes provided"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </article>
          </div>
        ) : (
          <div className="test-room-layout">
            <aside className="test-room-sidebar career-card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Progress</p>
                  <h3>
                    {answeredCount}/{questionCount} answered
                  </h3>
                </div>
                <Save size={15} />
              </div>

              <div className="test-room-question-grid" role="list" aria-label="Question palette">
                {questions.map((question, index) => {
                  const answered = questionAnswered(question, mcqAnswers, codingCompletion, codingNotes);
                  const active = index === currentIndex;

                  return (
                    <button
                      className={`test-room-question-chip${active ? " active" : ""}${answered ? " answered" : ""}`}
                      key={question.id}
                      onClick={() => setCurrentIndex(index)}
                      type="button"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </button>
                  );
                })}
              </div>

              <div className="test-room-side-meta">
                <p>
                  <strong>Deadline:</strong> {formatDateTime(attempt.deadlineAt)}
                </p>
                <p>
                  <strong>Started:</strong> {formatDateTime(attempt.startedAt)}
                </p>
              </div>

              {hasDesktopOnlyExecution(attempt.mode) ? (
                <div className="test-room-desktop-note">
                  <FileWarning size={14} />
                  <span>Coding execution is desktop-only. Use this page for prompt reading and notes.</span>
                </div>
              ) : null}

              <div className="test-room-side-actions">
                <button className="ghost-button" onClick={() => setShowSubmitModal(true)} type="button">
                  <AlertTriangle size={14} /> Submit Test
                </button>
                <Link className="ghost-button" href="/interview-prep">
                  Leave Test Room
                </Link>
              </div>
            </aside>

            <article className="career-card test-room-question-card">
              {currentQuestion ? (
                <>
                  <div className="card-header">
                    <div>
                      <p className="eyebrow">
                        Question {currentIndex + 1} of {questionCount}
                      </p>
                      <h2>{currentQuestion.category}</h2>
                      <p>{currentQuestion.kind === "coding" ? `Difficulty: ${currentQuestion.difficulty}` : "MCQ"}</p>
                    </div>
                    <span className={`pill ${currentQuestion.kind === "coding" ? "warning" : "brand"}`}>
                      {currentQuestion.kind.toUpperCase()}
                    </span>
                  </div>

                  <p className="test-room-question-prompt">{currentQuestion.prompt}</p>

                  {currentQuestionImageUrl ? (
                    <figure className="test-room-question-figure">
                      <Image
                        alt={currentQuestion.imageAlt ?? `${currentQuestion.category} visual aid`}
                        className="test-room-question-image"
                        height={360}
                        loading="lazy"
                        src={currentQuestionImageUrl}
                        width={920}
                      />
                      {currentQuestionImageSourceUrl ? (
                        <figcaption>
                          Source:{" "}
                          <a href={currentQuestionImageSourceUrl} rel="noopener noreferrer" target="_blank">
                            {currentQuestionImageSourceUrl}
                          </a>
                        </figcaption>
                      ) : null}
                    </figure>
                  ) : null}

                  {currentQuestion.kind === "mcq" ? (
                    <div className="test-room-options">
                      {currentQuestion.options.map((option) => {
                        const selected = (mcqAnswers[currentQuestion.id] ?? "").toLowerCase() === option.id;

                        return (
                          <button
                            className={`test-room-option${selected ? " selected" : ""}`}
                            key={`${currentQuestion.id}_${option.id}`}
                            onClick={() => {
                              setMcqAnswers((current) => ({
                                ...current,
                                [currentQuestion.id]: option.id
                              }));
                            }}
                            type="button"
                          >
                            <span>{option.id.toUpperCase()}</span>
                            <strong>{option.text}</strong>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="test-room-coding-block">
                      <div className="test-room-coding-meta">
                        <div>
                          <strong>Input Format</strong>
                          <p>{currentQuestion.inputFormat}</p>
                        </div>
                        <div>
                          <strong>Output Format</strong>
                          <p>{currentQuestion.outputFormat}</p>
                        </div>
                      </div>

                      {currentQuestion.constraints.length > 0 ? (
                        <div className="test-room-coding-meta">
                          <div>
                            <strong>Constraints</strong>
                            <ul className="topic-list" style={{ marginTop: 8 }}>
                              {currentQuestion.constraints.map((constraint) => (
                                <li key={constraint}>
                                  <p>{constraint}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : null}

                      <div className="test-room-coding-samples">
                        <div>
                          <strong>Sample Input</strong>
                          <pre>{currentQuestion.sampleInput || "N/A"}</pre>
                        </div>
                        <div>
                          <strong>Sample Output</strong>
                          <pre>{currentQuestion.sampleOutput || "N/A"}</pre>
                        </div>
                      </div>

                      <label className="profile-field" htmlFor={`coding-note-${currentQuestion.id}`}>
                        <span>Solution notes / approach</span>
                        <textarea
                          id={`coding-note-${currentQuestion.id}`}
                          onChange={(event) => {
                            const value = event.target.value;
                            setCodingNotes((current) => ({
                              ...current,
                              [currentQuestion.id]: value
                            }));
                          }}
                          placeholder="Write your approach, complexity, and edge cases while solving on desktop."
                          rows={7}
                          value={codingNotes[currentQuestion.id] ?? ""}
                        />
                      </label>

                      <label className="test-room-checkbox">
                        <input
                          checked={codingCompletion[currentQuestion.id] === true}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setCodingCompletion((current) => ({
                              ...current,
                              [currentQuestion.id]: checked
                            }));
                          }}
                          type="checkbox"
                        />
                        <span>Mark as solved on desktop</span>
                      </label>
                    </div>
                  )}

                  <div className="test-room-nav-actions">
                    <button
                      className="ghost-button"
                      disabled={currentIndex <= 0}
                      onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
                      type="button"
                    >
                      Previous
                    </button>
                    <button
                      className="ghost-button"
                      disabled={currentIndex >= questionCount - 1}
                      onClick={() => setCurrentIndex((value) => Math.min(questionCount - 1, value + 1))}
                      type="button"
                    >
                      Next
                    </button>
                    <button className="primary-button" onClick={() => setShowSubmitModal(true)} type="button">
                      Submit Test
                    </button>
                  </div>
                </>
              ) : null}
            </article>
          </div>
        )}
      </section>

      {showSubmitModal && !isSubmitted ? (
        <div className="profile-modal-overlay" role="presentation">
          <div className="profile-modal application-modal">
            <div className="card-header">
              <div>
                <p className="eyebrow">Confirm Submission</p>
                <h2>Submit this test now?</h2>
                <p>
                  You have answered {answeredCount} of {questionCount} questions.
                </p>
              </div>
              <AlertTriangle size={18} />
            </div>

            <div className="application-delete-warning" style={{ marginTop: 4 }}>
              <FileWarning size={16} />
              <div>
                <strong>Final step</strong>
                <span>Once submitted, the attempt moves to review mode and timer stops.</span>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="ghost-button" onClick={() => setShowSubmitModal(false)} type="button">
                <X size={14} /> Continue Test
              </button>
              <button className="primary-button" disabled={isSubmitting} onClick={() => void handleSubmit(false)} type="button">
                {isSubmitting ? <Loader2 className="spin" size={14} /> : <Check size={14} />} Confirm Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
