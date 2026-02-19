"use client";

import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  FlaskConical,
  Layers,
  Loader2,
  Sparkles,
  Target
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useUserPracticeAttempts,
  type PracticeAttemptRecord
} from "@/lib/firebase/interview-war-room";
import {
  formatInterviewTestType,
  getMcqQuestionById,
  type PracticeQuestion
} from "@/lib/interview/question-bank";
import { sanitizeExternalUrl } from "@/lib/url-safety";

type LearningTrackId = "computer-science" | "system-design" | "aptitude" | "ai";

type TopicSummary = {
  difficulty: string;
  focusKeywords: string[];
  id: string;
  title: string;
};

type SubjectSummary = {
  capstoneTasks: string[];
  defaultReferenceIds: string[];
  id: string;
  order: number;
  overview: string;
  selfAssessmentChecklist: string[];
  title: string;
  topicCount: number;
  topics: TopicSummary[];
};

type TrackSummary = {
  available: boolean;
  description: string;
  id: LearningTrackId;
  imageAlt: string;
  imageSrc: string;
  subjects: SubjectSummary[];
  subtitle: string;
  title: string;
  topicCount: number;
};

type LibraryPayload = {
  generatedAt: string;
  tracks: TrackSummary[];
};

type TopicReference = {
  bestFor?: string;
  id: string;
  publisher?: string;
  title: string;
  type?: string;
  url: string;
};

type TopicReferenceGroup = {
  id: string;
  references: TopicReference[];
  title: string;
};

type TopicDetail = {
  candidateTraps: string[];
  coreNotes: string[];
  difficulty: string;
  focusKeywords: string[];
  learningObjectives: string[];
  practiceDrills: string[];
  referenceGroups: TopicReferenceGroup[];
  rulesAndFormulas: string[];
  studyPlan: string[];
  subjectId: string;
  subjectTitle: string;
  title: string;
  topicId: string;
  unicodeSketch: string;
};

type WeakTopicRow = {
  earned: number;
  key: string;
  percentage: number;
  subtopic: string;
  topic: string;
  total: number;
};

type QuestionOutcome = {
  earned: number;
  total: number;
};

const TRACK_ICONS: Record<LearningTrackId, typeof BookOpen> = {
  "computer-science": FlaskConical,
  "system-design": Layers,
  aptitude: BookOpen,
  ai: BrainCircuit
};

const URL_PATTERN = /(https?:\/\/[^\s<>"')]+)/gi;

function toTrackMetricLabel(track: TrackSummary): string {
  if (!track.available) {
    return "Content coming soon";
  }

  return `${track.subjects.length} subjects / ${track.topicCount} topics`;
}

function linkifyText(text: string): ReactNode[] {
  if (!text) {
    return [text];
  }

  URL_PATTERN.lastIndex = 0;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null = URL_PATTERN.exec(text);

  while (match) {
    const fullMatch = match[0];
    const matchIndex = match.index;
    const safeUrl = sanitizeExternalUrl(fullMatch);

    if (matchIndex > cursor) {
      nodes.push(text.slice(cursor, matchIndex));
    }

    if (safeUrl) {
      nodes.push(
        <a
          className="learning-inline-link"
          href={safeUrl}
          key={`${fullMatch}-${matchIndex}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {fullMatch}
        </a>
      );
    } else {
      nodes.push(fullMatch);
    }

    cursor = matchIndex + fullMatch.length;
    match = URL_PATTERN.exec(text);
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length > 0 ? nodes : [text];
}

function DifficultyPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone =
    normalized === "easy"
      ? "success"
      : normalized === "medium"
        ? "warning"
        : normalized === "hard"
          ? "danger"
          : "brand";

  return <span className={`pill ${tone}`}>{value}</span>;
}

type DifficultyTone = "easy" | "medium" | "hard";

function resolveDifficultyTone(value: string): DifficultyTone {
  const normalized = value.toLowerCase();
  if (normalized.includes("hard")) {
    return "hard";
  }

  if (normalized.includes("medium")) {
    return "medium";
  }

  if (normalized.includes("easy") || normalized.includes("foundation") || normalized.includes("basic")) {
    return "easy";
  }

  return "medium";
}

function DifficultyCornerBadge({ value }: { value: string }) {
  const tone = resolveDifficultyTone(value);
  const label = tone.charAt(0).toUpperCase() + tone.slice(1);

  return (
    <span className={`learning-difficulty-corner ${tone}`} title={value}>
      <span className="learning-difficulty-dot" aria-hidden />
      {label}
    </span>
  );
}

function percentageFromMarks(earned: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((earned / total) * 100)));
}

function computeQuestionOutcome(
  attempt: PracticeAttemptRecord,
  question: PracticeQuestion
): QuestionOutcome {
  if (question.kind === "mcq") {
    const selected = (attempt.mcqAnswers[question.id] ?? "").trim().toLowerCase();
    const canonical = getMcqQuestionById(question.id);
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

function computeWeakTopicRows(attempts: PracticeAttemptRecord[]): WeakTopicRow[] {
  const tracker = new Map<string, WeakTopicRow>();

  attempts.forEach((attempt) => {
    const topic = formatInterviewTestType(attempt.testType);

    attempt.questions.forEach((question) => {
      const subtopic = question.category || "General";
      const key = `${topic}::${subtopic}`;
      const outcome = computeQuestionOutcome(attempt, question);
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
      if (first.percentage !== second.percentage) {
        return first.percentage - second.percentage;
      }

      if (second.total !== first.total) {
        return second.total - first.total;
      }

      return first.subtopic.localeCompare(second.subtopic);
    });
}

export default function LearningPage() {
  const { attempts: practiceAttempts, loading: practiceAttemptsLoading } = useUserPracticeAttempts();
  const [library, setLibrary] = useState<LibraryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<LearningTrackId | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [topicDetailsById, setTopicDetailsById] = useState<Record<string, TopicDetail>>({});
  const [topicDetailLoadingId, setTopicDetailLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/learning/library", {
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => null)) as
          | LibraryPayload
          | { error?: string }
          | null;

        if (!response.ok || !payload || !("tracks" in payload)) {
          throw new Error(
            payload && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Unable to load learning materials."
          );
        }

        if (cancelled) {
          return;
        }

        setLibrary(payload);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load learning materials.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLibrary();

    return () => {
      cancelled = true;
    };
  }, []);

  const tracks = useMemo(() => library?.tracks ?? [], [library]);

  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === selectedTrackId) ?? null,
    [selectedTrackId, tracks]
  );

  const selectedSubject = useMemo(
    () => selectedTrack?.subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, selectedTrack]
  );

  const selectedTopicSummary = useMemo(
    () => selectedSubject?.topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [selectedSubject, selectedTopicId]
  );
  const completedAttempts = useMemo(
    () => practiceAttempts.filter((attempt) => attempt.status === "submitted" || attempt.status === "timed_out"),
    [practiceAttempts]
  );
  const weakestTopicRows = useMemo(() => computeWeakTopicRows(completedAttempts).slice(0, 5), [completedAttempts]);

  const selectedTopicDetail = selectedTopicId ? topicDetailsById[selectedTopicId] ?? null : null;

  const handleTrackSelect = (trackId: LearningTrackId) => {
    setSelectedTrackId(trackId);
    setSelectedSubjectId(null);
    setSelectedTopicId(null);
    setError(null);
  };

  const handleBack = () => {
    if (selectedTopicId) {
      setSelectedTopicId(null);
      return;
    }

    if (selectedSubjectId) {
      setSelectedSubjectId(null);
      return;
    }

    setSelectedTrackId(null);
  };

  const handleSubjectSelect = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedTopicId(null);
    setError(null);
  };

  const handleTopicSelect = async (topicId: string) => {
    setSelectedTopicId(topicId);
    setError(null);

    if (!selectedTrackId || !selectedSubjectId || topicDetailsById[topicId]) {
      return;
    }

    setTopicDetailLoadingId(topicId);
    try {
      const params = new URLSearchParams({
        track: selectedTrackId,
        subjectId: selectedSubjectId,
        topicId
      });
      const response = await fetch(`/api/learning/topic?${params.toString()}`, {
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => null)) as
        | TopicDetail
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("topicId" in payload)) {
        throw new Error(
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to load topic details."
        );
      }

      setTopicDetailsById((current) => ({
        ...current,
        [topicId]: payload
      }));
    } catch (topicError) {
      setError(topicError instanceof Error ? topicError.message : "Unable to load topic details.");
    } finally {
      setTopicDetailLoadingId(null);
    }
  };

  return (
    <div className="page-stack">
      {error ? <p className="settings-feedback error">{error}</p> : null}
      {!selectedTrack && !loading && !practiceAttemptsLoading && weakestTopicRows.length > 0 ? (
        <section className="career-card analytics-topic-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Learning Focus</p>
              <h2>Your weakest topics</h2>
              <p>Based on your submitted tests. Start here before moving to stronger areas.</p>
            </div>
            <Target size={18} />
          </div>

          <div className="analytics-topic-block">
            <div className="analytics-topic-list">
              {weakestTopicRows.map((row) => (
                <div className="analytics-topic-row" key={`learning-weak-${row.key}`}>
                  <div className="row-between">
                    <strong>{row.subtopic}</strong>
                    <span>
                      {row.earned}/{row.total}
                    </span>
                  </div>
                  <p>{row.topic}</p>
                  <div className="analytics-topic-track">
                    <span style={{ width: `${row.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {loading ? (
        <section className="career-card">
          <div className="empty-drop">
            <Loader2 className="spin" size={16} />
            Loading learning library...
          </div>
        </section>
      ) : !selectedTrack ? (
        <section className="war-room-flip-grid" aria-label="Learning tracks">
          {tracks.map((track) => {
            const Icon = TRACK_ICONS[track.id];
            return (
              <button
                className="war-room-flip-card"
                data-track={track.id}
                key={track.id}
                onClick={() => handleTrackSelect(track.id)}
                type="button"
              >
                <span className="war-room-flip-inner">
                  <span className="war-room-flip-face war-room-flip-front">
                    <span className="war-room-flip-visual">
                      <Image alt={track.imageAlt} fill sizes="(max-width: 680px) 100vw, 25vw" src={track.imageSrc} />
                    </span>
                    <span className="war-room-flip-content">
                      <span className="eyebrow">Learning Track</span>
                      <strong>{track.title}</strong>
                      <span>{track.subtitle}</span>
                    </span>
                  </span>

                  <span className="war-room-flip-face war-room-flip-back">
                    <span className="war-room-flip-back-head">
                      <span className="metric-icon">
                        <Icon size={16} />
                      </span>
                      <strong>{toTrackMetricLabel(track)}</strong>
                    </span>
                    <p>{track.description}</p>
                    <p>
                      {track.available
                        ? "Open this track to drill down into subject tiles and subtopic reading content."
                        : "No file available for this track yet. Add a minified JSON in learning-material and refresh."}
                    </p>
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      ) : (
        <section className="war-room-ai-stage" aria-label="Learning explorer">
          <div className="war-room-ai-top-grid">
            <article className="career-card highlight learning-library-anchor" data-track={selectedTrack.id}>
              <div className="card-header">
                <div>
                  <p className="eyebrow">{selectedTopicSummary ? "Subtopic" : "Learning Library"}</p>
                  <h2>{selectedTopicSummary?.title ?? selectedSubject?.title ?? selectedTrack.title}</h2>
                  <p>
                    {selectedTopicSummary
                      ? `Reading material for ${selectedSubject?.title ?? "this subject"} is shown below.`
                      : selectedSubject
                        ? selectedSubject.overview || "Open a subtopic card to view detailed reading content."
                        : selectedTrack.description}
                  </p>
                </div>
                {selectedTopicSummary ? <DifficultyPill value={selectedTopicSummary.difficulty} /> : <Sparkles size={18} />}
              </div>

              <div className="tag-cloud">
                <span>{selectedTrack.subjects.length} subjects</span>
                <span>{selectedTrack.topicCount} topics</span>
                {selectedSubject ? <span>{selectedSubject.title}</span> : null}
                {selectedTopicSummary ? (
                  <span>
                    {selectedTopicSummary.focusKeywords.length > 0
                      ? selectedTopicSummary.focusKeywords.slice(0, 2).join(" / ")
                      : "Topic selected"}
                  </span>
                ) : selectedSubject ? (
                  <span>{selectedSubject.topicCount} in this subject</span>
                ) : null}
              </div>
            </article>

            <button
              aria-label="Go back"
              className="career-card war-room-go-back-card instant-tooltip-wrap"
              onClick={handleBack}
              type="button"
            >
              <span className="war-room-go-back-orbit" aria-hidden>
                <ArrowLeft size={28} />
              </span>
              <span className="instant-tooltip">Go Back</span>
            </button>
          </div>

          {!selectedTrack.available ? (
            <div className="career-card">
              <div className="empty-drop">
                No content available yet for {selectedTrack.title}. Add a minified JSON file to `learning-material`.
              </div>
            </div>
          ) : !selectedSubject ? (
            <div className="war-room-role-grid learning-subject-grid">
              {selectedTrack.subjects.map((subject) => (
                <button
                  className="war-room-flip-card war-room-role-card"
                  data-track={selectedTrack.id}
                  key={subject.id}
                  onClick={() => handleSubjectSelect(subject.id)}
                  type="button"
                >
                  <span className="war-room-flip-inner">
                    <span className="war-room-flip-face war-room-flip-front">
                      <span className="war-room-flip-visual">
                        <Image
                          alt={`${selectedTrack.title} subject visual`}
                          fill
                          sizes="(max-width: 680px) 100vw, (max-width: 1180px) 50vw, 25vw"
                          src={selectedTrack.imageSrc}
                        />
                      </span>
                      <span className="war-room-flip-content">
                        <span className="eyebrow">Subject</span>
                        <strong>{subject.title}</strong>
                        <span>{subject.topicCount} subtopics</span>
                      </span>
                    </span>

                    <span className="war-room-flip-face war-room-flip-back">
                      <span className="war-room-flip-back-head">
                        <span className="metric-icon">
                          <BookOpen size={16} />
                        </span>
                        <strong>{subject.topicCount} subtopics</strong>
                      </span>
                      <p>{subject.overview || "Open to view all subtopics and detailed material."}</p>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : !selectedTopicSummary ? (
            <>
              <div className="war-room-role-grid learning-topic-grid">
                {selectedSubject.topics.map((topic) => (
                  <button
                    className="war-room-flip-card war-room-role-card"
                    data-track={selectedTrack.id}
                    key={topic.id}
                    onClick={() => void handleTopicSelect(topic.id)}
                    type="button"
                  >
                    <span className="war-room-flip-inner">
                      <span className="war-room-flip-face war-room-flip-front learning-topic-front">
                        <span className="war-room-flip-visual">
                          <Image
                            alt={`${selectedTrack.title} subtopic visual`}
                            fill
                            sizes="(max-width: 680px) 100vw, (max-width: 1180px) 50vw, 25vw"
                            src={selectedTrack.imageSrc}
                          />
                        </span>
                        <span className="war-room-flip-content">
                          <span className="eyebrow">Subtopic</span>
                          <strong>{topic.title}</strong>
                          <span>
                            {topic.focusKeywords.length > 0
                              ? topic.focusKeywords.slice(0, 2).join(" / ")
                              : "Open to read full material"}
                          </span>
                        </span>
                        <DifficultyCornerBadge value={topic.difficulty} />
                      </span>

                      <span className="war-room-flip-face war-room-flip-back">
                        <span className="war-room-flip-back-head">
                          <span className="metric-icon">
                            <BookOpen size={16} />
                          </span>
                          <strong>{topic.difficulty} difficulty</strong>
                        </span>
                        <p>
                          {topic.focusKeywords.length > 0
                            ? topic.focusKeywords.slice(0, 5).join(" / ")
                            : "Read core notes, traps, drills, and references."}
                        </p>
                        <p>Open this subtopic to read the full material below.</p>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <article className="career-card learning-topic-detail-card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Topic Detail</p>
                  <h2>{selectedTopicSummary.title}</h2>
                  <p>{selectedSubject.title}</p>
                </div>
                <DifficultyPill value={selectedTopicSummary.difficulty} />
              </div>

              {topicDetailLoadingId === selectedTopicSummary.id && !selectedTopicDetail ? (
                <div className="empty-drop">
                  <Loader2 className="spin" size={16} />
                  Loading topic details...
                </div>
              ) : selectedTopicDetail ? (
                <div className="learning-topic-detail-grid">
                  {selectedTopicDetail.focusKeywords.length > 0 ? (
                    <section className="learning-topic-block">
                      <h3>Focus Keywords</h3>
                      <div className="tag-cloud">
                        {selectedTopicDetail.focusKeywords.map((keyword) => (
                          <span key={keyword}>{keyword}</span>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {selectedTopicDetail.learningObjectives.length > 0 ? (
                    <section className="learning-topic-block">
                      <h3>Learning Objectives</h3>
                      <ul className="learning-topic-list">
                        {selectedTopicDetail.learningObjectives.map((item) => (
                          <li key={item}>{linkifyText(item)}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedTopicDetail.coreNotes.length > 0 ? (
                    <section className="learning-topic-block">
                      <h3>Core Notes</h3>
                      <ul className="learning-topic-list">
                        {selectedTopicDetail.coreNotes.map((item) => (
                          <li key={item}>{linkifyText(item)}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedTopicDetail.rulesAndFormulas.length > 0 ? (
                    <section className="learning-topic-block">
                      <h3>Rules and Formulas</h3>
                      <ul className="learning-topic-list">
                        {selectedTopicDetail.rulesAndFormulas.map((item) => (
                          <li key={item}>{linkifyText(item)}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedTopicDetail.candidateTraps.length > 0 ? (
                    <section className="learning-topic-block">
                      <h3>Candidate Traps</h3>
                      <ul className="learning-topic-list">
                        {selectedTopicDetail.candidateTraps.map((item) => (
                          <li key={item}>{linkifyText(item)}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedTopicDetail.practiceDrills.length > 0 ? (
                    <section className="learning-topic-block">
                      <h3>Practice Drills</h3>
                      <ul className="learning-topic-list">
                        {selectedTopicDetail.practiceDrills.map((item) => (
                          <li key={item}>{linkifyText(item)}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedTopicDetail.unicodeSketch ? (
                    <section className="learning-topic-block">
                      <h3>Unicode Sketch</h3>
                      <pre className="learning-topic-sketch">{selectedTopicDetail.unicodeSketch}</pre>
                    </section>
                  ) : null}

                  {selectedTopicDetail.referenceGroups.map((group) => (
                    <section className="learning-topic-block" key={group.id}>
                      <h3>{group.title}</h3>
                      <div className="learning-reference-grid">
                        {group.references.map((reference) => {
                          const safeUrl = sanitizeExternalUrl(reference.url);

                          return (
                            <article className="learning-reference-card" key={`${group.id}-${reference.id}`}>
                              <strong>{reference.title}</strong>
                              <p>{reference.bestFor || reference.publisher || "Reference link"}</p>
                              {safeUrl ? (
                                <Link href={safeUrl} rel="noopener noreferrer" target="_blank">
                                  Open Reference
                                </Link>
                              ) : (
                                <span className="pill warning">Reference unavailable</span>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}

                  {selectedTopicDetail.studyPlan.length > 0 ? (
                    <section className="learning-topic-block">
                      <h3>Study Plan</h3>
                      <ul className="learning-topic-list">
                        {selectedTopicDetail.studyPlan.map((item) => (
                          <li key={item}>{linkifyText(item)}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedSubject.capstoneTasks.length > 0 ? (
                    <section className="learning-topic-block">
                      <h3>Capstone Tasks</h3>
                      <ul className="learning-topic-list">
                        {selectedSubject.capstoneTasks.map((item) => (
                          <li key={item}>{linkifyText(item)}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedSubject.selfAssessmentChecklist.length > 0 ? (
                    <section className="learning-topic-block">
                      <h3>Self Assessment Checklist</h3>
                      <ul className="learning-topic-list">
                        {selectedSubject.selfAssessmentChecklist.map((item) => (
                          <li key={item}>
                            <CheckCircle2 size={14} /> {linkifyText(item)}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              ) : (
                <div className="empty-drop">Open a subtopic card to load full reading material.</div>
              )}
            </article>
          )}
        </section>
      )}
    </div>
  );
}
