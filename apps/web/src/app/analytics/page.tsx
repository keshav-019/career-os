"use client";

import { BarChart3, CalendarDays, Gauge, Target, TrendingUp, Trophy } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { MetricCard } from "@/components/MetricCard";
import {
  useUserPracticeAttempts,
  type PracticeAttemptRecord
} from "@/lib/firebase/interview-war-room";
import { fetchAiInterviewRoles, fetchMcqReview, type McqReviewEntry } from "@/lib/interview/client";
import {
  formatInterviewTestType,
  type AiInterviewRole,
  type InterviewTestType,
  type PracticeQuestion
} from "@/lib/interview/question-bank";

type AttemptAnalyticsPoint = {
  attempt: PracticeAttemptRecord;
  earned: number;
  id: string;
  marksLabel: string;
  modeLabel: string;
  scorePercent: number;
  shortDateLabel: string;
  submittedAtLabel: string;
  submittedAtMs: number;
  submittedAtRaw: string;
  testTypeLabel: string;
  title: string;
  total: number;
};

type QuestionOutcome = {
  earned: number;
  total: number;
};

type TopicPerformanceRow = {
  earned: number;
  key: string;
  percentage: number;
  subtopic: string;
  topic: string;
  total: number;
};

const SUMMARY_PAGE_SIZE = 5;
const MAX_LABELLED_POINTS = 14;
type TrackFilter = "all" | InterviewTestType;

function toInputDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value: string): string {
  const parsed = parseDateMs(value);
  if (!parsed) {
    return "Not available";
  }

  return new Date(parsed).toLocaleString();
}

function formatShortDate(value: string): string {
  const parsed = parseDateMs(value);
  if (!parsed) {
    return "-";
  }

  return new Date(parsed).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function resolveAttemptTimestamp(attempt: PracticeAttemptRecord): string {
  return attempt.submittedAt ?? attempt.createdAt;
}

function percentageFromMarks(earned: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((earned / total) * 100)));
}

function computeQuestionOutcome(
  attempt: PracticeAttemptRecord,
  question: PracticeQuestion,
  mcqReviews: Record<string, McqReviewEntry>
): QuestionOutcome {
  if (question.kind === "mcq") {
    const selected = (attempt.mcqAnswers[question.id] ?? "").trim().toLowerCase();
    const canonical = mcqReviews[question.id];
    const earned = canonical && selected && selected === canonical.correctOptionId ? 1 : 0;
    return {
      earned,
      total: 1
    };
  }

  return {
    earned: attempt.codingCompletion[question.id] === true ? 1 : 0,
    total: 1
  };
}

function computeAttemptScore(
  attempt: PracticeAttemptRecord,
  mcqReviews: Record<string, McqReviewEntry>
): {
  earned: number;
  percentage: number;
  total: number;
} {
  if (attempt.mode === "mcq" && (attempt.score?.total ?? 0) > 0) {
    return {
      earned: attempt.score?.correct ?? 0,
      total: attempt.score?.total ?? 0,
      percentage: attempt.score?.percentage ?? 0
    };
  }

  const computed = attempt.questions.reduce(
    (aggregate, question) => {
      const outcome = computeQuestionOutcome(attempt, question, mcqReviews);
      aggregate.earned += outcome.earned;
      aggregate.total += outcome.total;
      return aggregate;
    },
    {
      earned: 0,
      total: 0
    }
  );

  const fallbackTotal = Math.max(0, attempt.questionCount);
  const total = computed.total > 0 ? computed.total : fallbackTotal;
  const earned = Math.min(computed.earned, total);

  return {
    earned,
    total,
    percentage: percentageFromMarks(earned, total)
  };
}

function computeTopicPerformance(
  attempts: PracticeAttemptRecord[],
  mcqReviews: Record<string, McqReviewEntry>
): TopicPerformanceRow[] {
  const tracker = new Map<string, TopicPerformanceRow>();

  attempts.forEach((attempt) => {
    const topic = formatInterviewTestType(attempt.testType);

    attempt.questions.forEach((question) => {
      const subtopic = question.category || "General";
      const key = `${topic}::${subtopic}`;
      const outcome = computeQuestionOutcome(attempt, question, mcqReviews);
      const current = tracker.get(key) ?? {
        key,
        topic,
        subtopic,
        earned: 0,
        total: 0,
        percentage: 0
      };

      current.earned += outcome.earned;
      current.total += outcome.total;
      tracker.set(key, current);
    });
  });

  return [...tracker.values()]
    .map((row) => ({
      ...row,
      percentage: percentageFromMarks(row.earned, row.total)
    }))
    .sort((first, second) => {
      if (second.percentage !== first.percentage) {
        return second.percentage - first.percentage;
      }

      if (second.total !== first.total) {
        return second.total - first.total;
      }

      return first.subtopic.localeCompare(second.subtopic);
    });
}

export default function AnalyticsPage() {
  const { attempts, error, loading } = useUserPracticeAttempts();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");
  const [aiRoleFilter, setAiRoleFilter] = useState("all");
  const [summaryPage, setSummaryPage] = useState(1);
  const [aiRoles, setAiRoles] = useState<AiInterviewRole[]>([]);
  const [mcqReviews, setMcqReviews] = useState<Record<string, McqReviewEntry>>({});

  useEffect(() => {
    let cancelled = false;
    fetchAiInterviewRoles()
      .then((roles) => {
        if (!cancelled) setAiRoles(roles);
      })
      .catch(() => {
        if (!cancelled) setAiRoles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const completedAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.status === "submitted" || attempt.status === "timed_out"),
    [attempts]
  );

  // getMcqQuestionById() used to run in-browser to recompute per-question outcomes for the topic breakdown below -
  // that function is now async (question content is fetched from R2 server-side), so the canonical answer key for
  // every MCQ question referenced by a completed attempt is fetched up front via /api/interview/mcq-review and
  // looked up synchronously from this map instead (see computeQuestionOutcome()).
  useEffect(() => {
    const mcqQuestionIds = Array.from(
      new Set(
        completedAttempts.flatMap((attempt) =>
          attempt.questions.filter((question) => question.kind === "mcq").map((question) => question.id)
        )
      )
    );

    if (mcqQuestionIds.length === 0) {
      setMcqReviews({});
      return;
    }

    let cancelled = false;
    fetchMcqReview(mcqQuestionIds)
      .then((result) => {
        if (!cancelled) setMcqReviews(result.reviews);
      })
      .catch(() => {
        if (!cancelled) setMcqReviews({});
      });
    return () => {
      cancelled = true;
    };
  }, [completedAttempts]);

  const analyticsPoints = useMemo<AttemptAnalyticsPoint[]>(() => {
    return completedAttempts
      .map((attempt) => {
        const timestamp = resolveAttemptTimestamp(attempt);
        const score = computeAttemptScore(attempt, mcqReviews);

        return {
          attempt,
          id: attempt.id,
          title: attempt.title,
          testTypeLabel: formatInterviewTestType(attempt.testType),
          modeLabel: attempt.mode.toUpperCase(),
          submittedAtRaw: timestamp,
          submittedAtMs: parseDateMs(timestamp),
          submittedAtLabel: formatDateTime(timestamp),
          shortDateLabel: formatShortDate(timestamp),
          scorePercent: score.percentage,
          earned: score.earned,
          total: score.total,
          marksLabel: `${score.earned}/${score.total}`
        };
      })
      .sort((first, second) => first.submittedAtMs - second.submittedAtMs);
  }, [completedAttempts, mcqReviews]);

  const suggestedDateRange = useMemo(() => {
    if (analyticsPoints.length === 0) {
      return {
        from: "",
        to: ""
      };
    }

    const firstDate = new Date(analyticsPoints[0].submittedAtMs);
    const lastDate = new Date(analyticsPoints[analyticsPoints.length - 1].submittedAtMs);
    const suggestedFrom = new Date(lastDate);
    suggestedFrom.setDate(suggestedFrom.getDate() - 30);

    return {
      from: toInputDate(suggestedFrom < firstDate ? firstDate : suggestedFrom),
      to: toInputDate(lastDate)
    };
  }, [analyticsPoints]);

  const effectiveFromDate = fromDate || suggestedDateRange.from;
  const effectiveToDate = toDate || suggestedDateRange.to;

  const rangeError = useMemo(() => {
    if (!effectiveFromDate || !effectiveToDate) {
      return null;
    }

    return Date.parse(`${effectiveFromDate}T00:00:00`) > Date.parse(`${effectiveToDate}T23:59:59.999`)
      ? "From date cannot be after To date."
      : null;
  }, [effectiveFromDate, effectiveToDate]);

  const dateFilteredPoints = useMemo(() => {
    if (rangeError) {
      return [] as AttemptAnalyticsPoint[];
    }

    const fromMs = effectiveFromDate ? Date.parse(`${effectiveFromDate}T00:00:00`) : Number.NEGATIVE_INFINITY;
    const toMs = effectiveToDate ? Date.parse(`${effectiveToDate}T23:59:59.999`) : Number.POSITIVE_INFINITY;

    return analyticsPoints.filter(
      (point) => point.submittedAtMs >= fromMs && point.submittedAtMs <= toMs
    );
  }, [analyticsPoints, effectiveFromDate, effectiveToDate, rangeError]);

  const filteredPoints = useMemo(() => {
    function resolveAiRoleFromTemplate(attempt: PracticeAttemptRecord): string | null {
      const templateId = (attempt.testTemplateId ?? "").trim();
      const match = templateId.match(/^ai_([a-z0-9-]+)_test_\d{3}$/);
      return match?.[1] ?? null;
    }

    return dateFilteredPoints.filter((point) => {
      if (trackFilter !== "all" && point.attempt.testType !== trackFilter) {
        return false;
      }

      if (trackFilter === "ai" && aiRoleFilter !== "all") {
        return resolveAiRoleFromTemplate(point.attempt) === aiRoleFilter;
      }

      return true;
    });
  }, [aiRoleFilter, dateFilteredPoints, trackFilter]);

  const summaryMetrics = useMemo(() => {
    const total = filteredPoints.length;
    const averageScore =
      total > 0
        ? Math.round(
            filteredPoints.reduce((sum, point) => sum + point.scorePercent, 0) / total
          )
        : 0;
    const bestScore =
      total > 0
        ? filteredPoints.reduce((max, point) => Math.max(max, point.scorePercent), 0)
        : 0;
    const latestScore = total > 0 ? filteredPoints[total - 1].scorePercent : 0;
    const firstScore = total > 1 ? filteredPoints[0].scorePercent : latestScore;
    const trendDelta = total > 1 ? latestScore - firstScore : 0;

    return {
      averageScore,
      bestScore,
      latestScore,
      total,
      trendDelta
    };
  }, [filteredPoints]);

  const showTestLabels = filteredPoints.length <= MAX_LABELLED_POINTS;

  const topicRows = useMemo(
    () => computeTopicPerformance(filteredPoints.map((point) => point.attempt), mcqReviews),
    [filteredPoints, mcqReviews]
  );

  const strongestRows = useMemo(() => {
    if (topicRows.length <= 5) {
      return topicRows;
    }

    return topicRows.slice(0, 5);
  }, [topicRows]);

  const weakestRows = useMemo(() => {
    if (topicRows.length === 0) {
      return [] as TopicPerformanceRow[];
    }

    const ascending = [...topicRows].sort((first, second) => {
      if (first.percentage !== second.percentage) {
        return first.percentage - second.percentage;
      }

      if (second.total !== first.total) {
        return second.total - first.total;
      }

      return first.subtopic.localeCompare(second.subtopic);
    });

    if (ascending.length <= 5) {
      return ascending;
    }

    return ascending.slice(0, 5);
  }, [topicRows]);

  const totalSummaryPages = Math.max(1, Math.ceil(filteredPoints.length / SUMMARY_PAGE_SIZE));
  const activeSummaryPage = Math.min(summaryPage, totalSummaryPages);
  const chartColumnCount = Math.max(10, filteredPoints.length);
  const chartSlots = useMemo(
    () =>
      Array.from({ length: chartColumnCount }, (_, index) =>
        index < filteredPoints.length ? filteredPoints[index] : null
      ),
    [chartColumnCount, filteredPoints]
  );
  const paginatedSummary = useMemo(() => {
    const startIndex = (activeSummaryPage - 1) * SUMMARY_PAGE_SIZE;
    return filteredPoints.slice(startIndex, startIndex + SUMMARY_PAGE_SIZE);
  }, [activeSummaryPage, filteredPoints]);

  return (
    <div className="page-stack">
      {error ? <p className="settings-feedback error">{error}</p> : null}
      {rangeError ? <p className="settings-feedback error">{rangeError}</p> : null}

      <section className="career-card analytics-track-card">
        <div className="analytics-filter-controls">
          <label className="analytics-filter-field">
            <span>Track</span>
            <select
              onChange={(event) => {
                const nextTrack = event.target.value as TrackFilter;
                setTrackFilter(nextTrack);
                if (nextTrack !== "ai") {
                  setAiRoleFilter("all");
                }
                setSummaryPage(1);
              }}
              value={trackFilter}
            >
              <option value="all">All Tracks</option>
              <option value="coding">Coding</option>
              <option value="aptitude">Aptitude</option>
              <option value="computer-science">Computer Science</option>
              <option value="ai">AI</option>
            </select>
          </label>

          {trackFilter === "ai" ? (
            <label className="analytics-filter-field">
              <span>AI Role</span>
              <select
                onChange={(event) => {
                  setAiRoleFilter(event.target.value);
                  setSummaryPage(1);
                }}
                value={aiRoleFilter}
              >
                <option value="all">All AI Roles</option>
                {aiRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      <section className="metric-grid" aria-label="Analytics metrics">
        <MetricCard
          detail={loading ? "Syncing your attempts" : "Tests submitted in selected date range"}
          icon={TrendingUp}
          label="Tests Taken"
          tone="green"
          value={String(summaryMetrics.total)}
        />
        <MetricCard
          detail={loading ? "Syncing your attempts" : "Average score out of 100"}
          icon={BarChart3}
          label="Average Score"
          tone="blue"
          value={`${summaryMetrics.averageScore}/100`}
        />
        <MetricCard
          detail={loading ? "Syncing your attempts" : "Highest score in selected date range"}
          icon={Trophy}
          label="Best Score"
          tone="amber"
          value={`${summaryMetrics.bestScore}/100`}
        />
        <MetricCard
          detail={
            loading
              ? "Syncing your attempts"
              : `Latest score is ${summaryMetrics.latestScore}/100, trend ${summaryMetrics.trendDelta >= 0 ? "+" : ""}${summaryMetrics.trendDelta}`
          }
          icon={Gauge}
          label="Latest Score"
          tone="rose"
          value={`${summaryMetrics.latestScore}/100`}
        />
      </section>

      <section className="career-card analytics-score-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Score Timeline</p>
            <h2>Test performance trend (out of 100)</h2>
            <p>Filter by date range and review how your score moved across attempts.</p>
          </div>
          <div className="analytics-controls">
            <div className="analytics-date-controls">
              <label className="analytics-date-field">
                <span>From</span>
                <input
                  max={effectiveToDate || undefined}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setSummaryPage(1);
                  }}
                  type="date"
                  value={effectiveFromDate}
                />
              </label>
              <label className="analytics-date-field">
                <span>To</span>
                <input
                  min={effectiveFromDate || undefined}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setSummaryPage(1);
                  }}
                  type="date"
                  value={effectiveToDate}
                />
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty-drop">Loading analytics...</div>
        ) : completedAttempts.length === 0 ? (
          <div className="empty-drop">Attempt a test so you can view this section.</div>
        ) : filteredPoints.length === 0 ? (
          <div className="empty-drop">No test attempts in this date range.</div>
        ) : (
          <>
            <div
              className="analytics-chart-stage"
              style={
                {
                  "--analytics-bar-count": String(chartColumnCount)
                } as CSSProperties
              }
            >
              <div className="analytics-bar-grid">
                {chartSlots.map((point, index) =>
                  point ? (
                    <div className="analytics-bar-slot" key={point.id}>
                      <div className="analytics-bar-track">
                        <span className="analytics-bar-fill" style={{ height: `${point.scorePercent}%` }} />
                      </div>
                      <strong>{point.scorePercent}</strong>
                      <span className="analytics-bar-date">{point.shortDateLabel}</span>
                      {showTestLabels ? (
                        <span className="analytics-bar-test">{point.title}</span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="analytics-bar-slot analytics-bar-slot-empty" key={`empty-${index}`}>
                      <div className="analytics-bar-track analytics-bar-track-empty" />
                      <strong aria-hidden>0</strong>
                      <span aria-hidden className="analytics-bar-date">
                        -
                      </span>
                      {showTestLabels ? (
                        <span aria-hidden className="analytics-bar-test">
                          Placeholder
                        </span>
                      ) : null}
                    </div>
                  )
                )}
              </div>
            </div>

            {!showTestLabels ? (
              <p className="muted analytics-chart-note">
                Data density is high in this date range, so test names are hidden to keep the chart readable.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="two-column-grid">
        <article className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Attempt Summary</p>
              <h2>Tests in selected date range</h2>
              <p>Showing exact date and marks for each submitted attempt.</p>
            </div>
            <span className="pill">
              <CalendarDays size={12} /> {filteredPoints.length} attempts
            </span>
          </div>

          {filteredPoints.length === 0 ? (
            <div className="empty-drop">Attempt a test so you can view this section.</div>
          ) : (
            <>
              <div className="analytics-summary-list">
                {paginatedSummary.map((point) => (
                  <article className="analytics-summary-card" key={`summary-${point.id}`}>
                    <div className="row-between">
                      <strong>{point.title}</strong>
                      <span className="pill brand">{point.scorePercent}/100</span>
                    </div>
                    <p className="muted">
                      {point.testTypeLabel} / {point.modeLabel}
                    </p>
                    <div className="row-between analytics-summary-meta">
                      <span>{point.submittedAtLabel}</span>
                      <span>{point.marksLabel}</span>
                    </div>
                    <div className="analytics-summary-track">
                      <span style={{ width: `${point.scorePercent}%` }} />
                    </div>
                  </article>
                ))}
              </div>

              <div className="analytics-pagination">
                <button
                  className="ghost-button"
                  disabled={activeSummaryPage <= 1}
                  onClick={() => setSummaryPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  Previous
                </button>
                <span className="analytics-page-indicator">
                  Page {activeSummaryPage} / {totalSummaryPages}
                </span>
                <button
                  className="ghost-button"
                  disabled={activeSummaryPage >= totalSummaryPages}
                  onClick={() =>
                    setSummaryPage((current) => Math.min(totalSummaryPages, current + 1))
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </article>

        <aside className="career-card analytics-topic-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Topic Intelligence</p>
              <h2>Strongest and weakest areas</h2>
              <p>Computed from scored questions in the selected date range.</p>
            </div>
            <Target size={18} />
          </div>

          <div className="analytics-topic-block">
            <h3>Strongest Topics</h3>
            {strongestRows.length === 0 ? (
              <div className="empty-drop">Attempt a test so you can view this section.</div>
            ) : (
              <div className="analytics-topic-list">
                {strongestRows.map((row) => (
                  <div className="analytics-topic-row" key={`strong-${row.key}`}>
                    <div className="row-between">
                      <strong>{row.subtopic}</strong>
                      <span>{row.earned}/{row.total}</span>
                    </div>
                    <p>{row.topic}</p>
                    <div className="analytics-topic-track">
                      <span style={{ width: `${row.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="analytics-topic-block">
            <h3>Weakest Topics</h3>
            {weakestRows.length === 0 ? (
              <div className="empty-drop">Attempt a test so you can view this section.</div>
            ) : (
              <div className="analytics-topic-list">
                {weakestRows.map((row) => (
                  <div className="analytics-topic-row" key={`weak-${row.key}`}>
                    <div className="row-between">
                      <strong>{row.subtopic}</strong>
                      <span>{row.earned}/{row.total}</span>
                    </div>
                    <p>{row.topic}</p>
                    <div className="analytics-topic-track">
                      <span style={{ width: `${row.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
