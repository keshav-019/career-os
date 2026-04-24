"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  FlaskConical,
  ImagePlus,
  Loader2,
  Pencil,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Wand2,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { auth } from "@/lib/firebase/client";
import {
  useUserPracticeAttempts,
  type PracticeAttemptRecord
} from "@/lib/firebase/interview-war-room";
import { fetchMcqReview, type McqReviewEntry } from "@/lib/interview/client";
import {
  formatInterviewTestType,
  type PracticeQuestion
} from "@/lib/interview/question-bank";
import { learningAssetUrl } from "@/lib/learning/asset-url";
import { LEARNING_PLAN_REQUEST_EVENT } from "@/lib/preferences";
import { sanitizeExternalUrl } from "@/lib/url-safety";

type LearningTrackId = "computer-science" | "ai";

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

type TopicFigure = {
  caption?: string;
  description?: string;
  height?: number;
  id: string;
  page?: number;
  reference?: string;
  src: string;
  width?: number;
};

type TopicDetail = {
  difficulty: string;
  figures: TopicFigure[];
  focusKeywords: string[];
  pageEnd?: number;
  pageStart?: number;
  paragraphPages: number[];
  readingParagraphs: string[];
  referenceGroups: TopicReferenceGroup[];
  subjectId: string;
  subjectTitle: string;
  title: string;
  topicId: string;
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

type AiLearningPlanModule = {
  priority: number;
  reason: string;
  subjectId: string;
  subjectTitle: string;
  topicCount: number;
  trackId: string;
  trackTitle: string;
};

type AiLearningPlan = {
  hasTestHistory: boolean;
  modules: AiLearningPlanModule[];
  summary: string;
};

type PendingEditorFigure = {
  caption: string;
  dataUrl?: string;
  description: string;
  height?: number;
  id: string;
  page?: number;
  reference: string;
  src?: string;
  width?: number;
};

type ImageDraft = PendingEditorFigure & {
  fileName?: string;
};

const TRACK_ICONS: Record<LearningTrackId, typeof BookOpen> = {
  "computer-science": FlaskConical,
  ai: BrainCircuit
};

const URL_PATTERN = /(https?:\/\/[^\s<>"')]+)/gi;
const FIGURE_MARKER_PATTERN = /\[\[figure:([a-zA-Z0-9_.:-]+)\]\]/g;

function toTrackMetricLabel(track: TrackSummary): string {
  if (!track.available) {
    return "Content coming soon";
  }

  return `${track.subjects.length} subjects / ${track.topicCount} topics`;
}

function resetLearningViewport() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ left: 0, top: 0, behavior: "auto" });
  });
}

function sanitizeEditorFigureId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildEditorFigureId(detail: TopicDetail | null, pendingFigures: PendingEditorFigure[]): string {
  const existingCount = (detail?.figures.length ?? 0) + pendingFigures.length + 1;
  const base = detail?.topicId.split("::").pop() ?? "topic";
  return sanitizeEditorFigureId(`${base}-custom-figure-${existingCount}`) || `custom-figure-${Date.now()}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read pasted image."));
    };
    reader.onerror = () => reject(new Error("Unable to read pasted image."));
    reader.readAsDataURL(file);
  });
}

function loadBrowserImageDimensions(src: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      resolve({
        height: image.naturalHeight,
        width: image.naturalWidth
      });
    };
    image.onerror = () => reject(new Error("Unable to inspect image dimensions."));
    image.src = src;
  });
}

function collectFigureMarkerIds(paragraphs: string[]): Set<string> {
  const ids = new Set<string>();

  paragraphs.forEach((paragraph) => {
    FIGURE_MARKER_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null = FIGURE_MARKER_PATTERN.exec(paragraph);
    while (match) {
      ids.add(match[1]);
      match = FIGURE_MARKER_PATTERN.exec(paragraph);
    }
  });

  return ids;
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

function linkifyAndCodeText(text: string): ReactNode[] {
  if (!text) {
    return [text];
  }

  const segments = text.split(/`([^`]+)`/g);
  const nodes: ReactNode[] = [];

  segments.forEach((segment, index) => {
    if (!segment) {
      return;
    }

    if (index % 2 === 1) {
      nodes.push(
        <code className="learning-inline-code" key={`inline-code-${index}`}>
          {segment}
        </code>
      );
      return;
    }

    nodes.push(...linkifyText(segment));
  });

  return nodes.length > 0 ? nodes : [text];
}

type TripleQuotedChunk = {
  content: string;
  kind: "code" | "text";
};

function splitTripleQuotedChunks(value: string): TripleQuotedChunk[] {
  const chunks: TripleQuotedChunk[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const opening = value.indexOf('"""', cursor);
    if (opening === -1) {
      chunks.push({
        kind: "text",
        content: value.slice(cursor)
      });
      break;
    }

    if (opening > cursor) {
      chunks.push({
        kind: "text",
        content: value.slice(cursor, opening)
      });
    }

    const closing = value.indexOf('"""', opening + 3);
    if (closing === -1) {
      chunks.push({
        kind: "code",
        content: value.slice(opening + 3)
      });
      break;
    }

    chunks.push({
      kind: "code",
      content: value.slice(opening + 3, closing)
    });
    cursor = closing + 3;
  }

  return chunks;
}

function renderLearningHeading(level: number, text: string, key: string): ReactNode {
  const className = `learning-topic-heading learning-topic-heading-${Math.min(Math.max(level, 1), 5)}`;

  if (level <= 1) {
    return (
      <h3 className={className} key={key}>
        {text}
      </h3>
    );
  }

  if (level === 2) {
    return (
      <h4 className={className} key={key}>
        {text}
      </h4>
    );
  }

  return (
    <h5 className={className} key={key}>
      {text}
    </h5>
  );
}

function renderTextWithSubheaders(text: string, keyBase: string): ReactNode[] {
  const lines = text.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  const paragraphLines: string[] = [];

  const flushParagraph = (suffix: string) => {
    const paragraphText = paragraphLines.join(" ").trim();
    if (!paragraphText) {
      paragraphLines.length = 0;
      return;
    }

    nodes.push(<p key={`${keyBase}-p-${suffix}`}>{linkifyAndCodeText(paragraphText)}</p>);
    paragraphLines.length = 0;
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph(String(index));
      return;
    }

    const markdownHeading = line.match(/^(#{1,5})\s+(.+)$/);
    if (markdownHeading) {
      const level = markdownHeading[1].length;
      flushParagraph(`before-heading-${index}`);
      nodes.push(renderLearningHeading(level, markdownHeading[2].trim(), `${keyBase}-heading-${index}`));
      return;
    }

    const numberedSubheader = line.match(/^(\d+\.\d+(?:\.\d+)*)\s+(.+)$/);
    if (numberedSubheader) {
      flushParagraph(`before-numbered-subheader-${index}`);
      nodes.push(renderLearningHeading(3, `${numberedSubheader[1]} ${numberedSubheader[2]}`, `${keyBase}-nh-${index}`));
      return;
    }

    paragraphLines.push(line);
  });

  flushParagraph("final");
  return nodes;
}

function renderTextAndTripleQuotedBlocks(text: string, keyBase: string): ReactNode[] {
  const chunks = splitTripleQuotedChunks(text);
  const nodes: ReactNode[] = [];

  chunks.forEach((chunk, index) => {
    if (chunk.kind === "code") {
      const codeBody = chunk.content.trim();
      if (!codeBody) {
        return;
      }

      nodes.push(
        <div className="learning-code-block" key={`${keyBase}-triple-code-${index}`}>
          <pre>
            <code>{codeBody}</code>
          </pre>
        </div>
      );
      return;
    }

    nodes.push(...renderTextWithSubheaders(chunk.content, `${keyBase}-text-${index}`));
  });

  return nodes;
}

function renderTopicParagraph(paragraph: string, keyBase: string): ReactNode {
  if (!paragraph.trim()) {
    return null;
  }

  const fragments = paragraph.split(/(```[\s\S]*?```)/g).filter(Boolean);

  return (
    <div className="learning-topic-paragraph">
      {fragments.map((fragment, fragmentIndex) => {
        const isFenceCode = fragment.startsWith("```") && fragment.endsWith("```");
        if (isFenceCode) {
          const codeBody = fragment
            .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
            .replace(/```$/, "")
            .trim();

          if (!codeBody) {
            return null;
          }

          return (
            <div className="learning-code-block" key={`${keyBase}-fence-code-${fragmentIndex}`}>
              <pre>
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        const textNodes = renderTextAndTripleQuotedBlocks(fragment, `${keyBase}-fragment-${fragmentIndex}`);
        return (
          <div key={`${keyBase}-fragment-wrap-${fragmentIndex}`}>
            {textNodes.length > 0 ? textNodes : null}
          </div>
        );
      })}
    </div>
  );
}

function renderInlineFigure(
  figure: TopicFigure,
  index: number,
  topicId: string
): ReactNode {
  const versionSuffix =
    typeof figure.width === "number" && typeof figure.height === "number" ? `${figure.width}x${figure.height}` : "";
  const resolvedFigureSrc = learningAssetUrl(figure.src);
  const figureSrc = versionSuffix
    ? `${resolvedFigureSrc}${resolvedFigureSrc.includes("?") ? "&" : "?"}v=${versionSuffix}`
    : resolvedFigureSrc;

  return (
    <figure className="learning-figure-card learning-figure-inline" key={`${topicId}-${figure.id}-${index}`}>
      <div className="learning-figure-media">
        <Image
          alt={figure.caption || `Figure ${index + 1}`}
          height={figure.height ?? 720}
          sizes="(max-width: 680px) 100vw, (max-width: 1180px) 70vw, 860px"
          src={figureSrc}
          unoptimized
          width={figure.width ?? 1080}
        />
      </div>
      <figcaption className="learning-figure-caption">
        <strong>{figure.caption || figure.description || `Figure ${index + 1}`}</strong>
        {figure.description && figure.caption ? <span>{figure.description}</span> : null}
        {figure.reference ? <span>Reference: {figure.reference}</span> : null}
      </figcaption>
    </figure>
  );
}

function renderParagraphWithFigureMarkers(
  paragraph: string,
  keyBase: string,
  figuresById: Map<string, TopicFigure>,
  renderedFigureIds: Set<string>,
  topicId: string
): ReactNode[] {
  FIGURE_MARKER_PATTERN.lastIndex = 0;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null = FIGURE_MARKER_PATTERN.exec(paragraph);

  while (match) {
    const markerStart = match.index;
    const markerEnd = markerStart + match[0].length;
    const before = paragraph.slice(cursor, markerStart).trim();
    if (before) {
      nodes.push(renderTopicParagraph(before, `${keyBase}-text-${nodes.length}`));
    }

    const figureId = match[1];
    const figure = figuresById.get(figureId);
    if (figure) {
      renderedFigureIds.add(figure.id);
      nodes.push(renderInlineFigure(figure, renderedFigureIds.size - 1, topicId));
    } else {
      nodes.push(
        <p className="settings-feedback error" key={`${keyBase}-missing-figure-${markerStart}`}>
          Missing image reference: {figureId}
        </p>
      );
    }

    cursor = markerEnd;
    match = FIGURE_MARKER_PATTERN.exec(paragraph);
  }

  const after = paragraph.slice(cursor).trim();
  if (after) {
    nodes.push(renderTopicParagraph(after, `${keyBase}-text-${nodes.length}`));
  }

  return nodes.length > 0 ? nodes : [renderTopicParagraph(paragraph, `${keyBase}-text`)];
}

function buildReadingTimeline(detail: TopicDetail): ReactNode[] {
  const nodes: ReactNode[] = [];
  const figures = [...detail.figures].sort((first, second) => (first.page ?? 9999) - (second.page ?? 9999));
  const figuresById = new Map(figures.map((figure) => [figure.id, figure]));
  const markedFigureIds = collectFigureMarkerIds(detail.readingParagraphs);
  const renderedFigureIds = new Set<string>();
  const paragraphPageHints =
    detail.paragraphPages.length === detail.readingParagraphs.length
      ? detail.paragraphPages
      : detail.readingParagraphs.map((_, index) => detail.pageStart ?? index + 1);

  let figureIndex = 0;

  detail.readingParagraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphPage =
      typeof paragraphPageHints[paragraphIndex] === "number" ? paragraphPageHints[paragraphIndex] : 0;

    while (figureIndex < figures.length) {
      const currentFigure = figures[figureIndex];
      const figurePage = currentFigure.page ?? Number.POSITIVE_INFINITY;

      if (
        !markedFigureIds.has(currentFigure.id)
        && !renderedFigureIds.has(currentFigure.id)
        && paragraphPage > 0
        && Number.isFinite(figurePage)
        && figurePage <= paragraphPage
      ) {
        renderedFigureIds.add(currentFigure.id);
        nodes.push(renderInlineFigure(currentFigure, figureIndex, detail.topicId));
        figureIndex += 1;
        continue;
      }

      if (markedFigureIds.has(currentFigure.id) || renderedFigureIds.has(currentFigure.id)) {
        figureIndex += 1;
        continue;
      }

      break;
    }

    nodes.push(
      <div key={`${detail.topicId}-paragraph-${paragraphIndex}`}>
        {renderParagraphWithFigureMarkers(
          paragraph,
          `${detail.topicId}-paragraph-${paragraphIndex}`,
          figuresById,
          renderedFigureIds,
          detail.topicId
        )}
      </div>
    );
  });

  while (figureIndex < figures.length) {
    if (!renderedFigureIds.has(figures[figureIndex].id)) {
      renderedFigureIds.add(figures[figureIndex].id);
      nodes.push(renderInlineFigure(figures[figureIndex], figureIndex, detail.topicId));
    }
    figureIndex += 1;
  }

  return nodes;
}

function toEditorParagraphsText(paragraphs: string[]): string {
  return paragraphs.join("\n\n");
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

function computeWeakTopicRows(
  attempts: PracticeAttemptRecord[],
  mcqReviews: Record<string, McqReviewEntry>
): WeakTopicRow[] {
  const tracker = new Map<string, WeakTopicRow>();

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
      if (first.percentage !== second.percentage) {
        return first.percentage - second.percentage;
      }

      if (second.total !== first.total) {
        return second.total - first.total;
      }

      return first.subtopic.localeCompare(second.subtopic);
    });
}

function isLearningTrackId(value: string): value is LearningTrackId {
  return value === "computer-science" || value === "ai";
}

export default function LearningPage() {
  const { attempts: practiceAttempts, loading: practiceAttemptsLoading } = useUserPracticeAttempts();
  const topicEditorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const topicEditorInsertRangeRef = useRef<{ end: number; start: number } | null>(null);
  const [library, setLibrary] = useState<LibraryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<LearningTrackId | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [topicDetailsById, setTopicDetailsById] = useState<Record<string, TopicDetail>>({});
  const [topicDetailLoadingId, setTopicDetailLoadingId] = useState<string | null>(null);
  const [isTopicEditing, setIsTopicEditing] = useState(false);
  const [topicEditorText, setTopicEditorText] = useState("");
  const [topicEditorSaving, setTopicEditorSaving] = useState(false);
  const [topicEditorError, setTopicEditorError] = useState<string | null>(null);
  const [topicEditorSuccess, setTopicEditorSuccess] = useState<string | null>(null);
  const [isLocalLearningAdmin, setIsLocalLearningAdmin] = useState(false);
  const [pendingEditorFigures, setPendingEditorFigures] = useState<PendingEditorFigure[]>([]);
  const [imageDraft, setImageDraft] = useState<ImageDraft | null>(null);
  const [imageDraftOpen, setImageDraftOpen] = useState(false);
  const [imageDraftError, setImageDraftError] = useState<string | null>(null);
  const [imageDraftLoading, setImageDraftLoading] = useState(false);
  const [learningPlan, setLearningPlan] = useState<AiLearningPlan | null>(null);
  const [learningPlanLoading, setLearningPlanLoading] = useState(false);
  const [learningPlanError, setLearningPlanError] = useState<string | null>(null);
  const [learningPlanRequested, setLearningPlanRequested] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function loadAdminStatus() {
      try {
        const response = await fetch("/api/learning/admin/session", {
          cache: "no-store",
          credentials: "same-origin"
        });
        const payload = (await response.json().catch(() => null)) as { authenticated?: boolean } | null;
        if (!cancelled) {
          setIsLocalLearningAdmin(Boolean(response.ok && payload?.authenticated));
        }
      } catch {
        if (!cancelled) {
          setIsLocalLearningAdmin(false);
        }
      }
    }

    void loadAdminStatus();

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

  const [mcqReviews, setMcqReviews] = useState<Record<string, McqReviewEntry>>({});

  // getMcqQuestionById() used to run in-browser for the weak-topic breakdown below - that function is now async
  // (question content is fetched from R2 server-side), so the canonical answer key for every MCQ question
  // referenced by a completed attempt is fetched up front via /api/interview/mcq-review instead.
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

  const weakestTopicRows = useMemo(
    () => computeWeakTopicRows(completedAttempts, mcqReviews).slice(0, 5),
    [completedAttempts, mcqReviews]
  );

  const selectedTopicDetail = selectedTopicId ? topicDetailsById[selectedTopicId] ?? null : null;

  const handleGenerateLearningPlan = useCallback(async () => {
    if (learningPlanLoading) {
      return;
    }

    if (!library || tracks.length === 0) {
      setLearningPlanError("Learning materials are still loading. Try again in a moment.");
      return;
    }

    setLearningPlanRequested(true);
    setLearningPlanLoading(true);
    setLearningPlanError(null);

    try {
      const tracksPayload = tracks
        .filter((track) => track.available && track.subjects.length > 0)
        .map((track) => ({
          id: track.id,
          title: track.title,
          subjects: track.subjects.map((subject) => ({
            id: subject.id,
            order: subject.order,
            overview: subject.overview,
            title: subject.title,
            topicCount: subject.topicCount
          }))
        }));

      const weakRowsPayload = computeWeakTopicRows(completedAttempts, mcqReviews)
        .slice(0, 12)
        .map((row) => ({
          earned: row.earned,
          percentage: row.percentage,
          subtopic: row.subtopic,
          topic: row.topic,
          total: row.total
        }));

      const idToken = await auth?.currentUser?.getIdToken().catch(() => null);
      const response = await fetch("/api/ai/learning-plan", {
        body: JSON.stringify({ tracks: tracksPayload, weakRows: weakRowsPayload }),
        headers: {
          "content-type": "application/json",
          ...(idToken ? { authorization: `Bearer ${idToken}` } : {})
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as
        | { plan?: AiLearningPlan }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("plan" in payload) || !payload.plan) {
        throw new Error(
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to generate a learning plan."
        );
      }

      setLearningPlan(payload.plan);
    } catch (planError) {
      setLearningPlanError(planError instanceof Error ? planError.message : "Unable to generate a learning plan.");
    } finally {
      setLearningPlanLoading(false);
    }
  }, [completedAttempts, learningPlanLoading, library, mcqReviews, tracks]);

  useEffect(() => {
    const onLearningPlanRequested = () => {
      void handleGenerateLearningPlan();
    };

    window.addEventListener(LEARNING_PLAN_REQUEST_EVENT, onLearningPlanRequested);
    return () => window.removeEventListener(LEARNING_PLAN_REQUEST_EVENT, onLearningPlanRequested);
  }, [handleGenerateLearningPlan]);

  const handleOpenPlanModule = (module: AiLearningPlanModule) => {
    if (!isLearningTrackId(module.trackId)) {
      return;
    }

    resetTopicEditorState();
    setSelectedTrackId(module.trackId);
    setSelectedSubjectId(module.subjectId);
    setSelectedTopicId(null);
    setError(null);
    resetLearningViewport();
  };

  const resetTopicEditorState = () => {
    setIsTopicEditing(false);
    setTopicEditorText("");
    setTopicEditorSaving(false);
    setTopicEditorError(null);
    setTopicEditorSuccess(null);
    setPendingEditorFigures([]);
    setImageDraft(null);
    setImageDraftOpen(false);
    setImageDraftError(null);
    setImageDraftLoading(false);
  };

  const handleTrackSelect = (trackId: LearningTrackId) => {
    resetTopicEditorState();
    setSelectedTrackId(trackId);
    setSelectedSubjectId(null);
    setSelectedTopicId(null);
    setError(null);
    resetLearningViewport();
  };

  const handleBack = () => {
    resetTopicEditorState();
    if (selectedTopicId) {
      setSelectedTopicId(null);
      resetLearningViewport();
      return;
    }

    if (selectedSubjectId) {
      setSelectedSubjectId(null);
      resetLearningViewport();
      return;
    }

    setSelectedTrackId(null);
    resetLearningViewport();
  };

  const handleSubjectSelect = (subjectId: string) => {
    resetTopicEditorState();
    setSelectedSubjectId(subjectId);
    setSelectedTopicId(null);
    setError(null);
    resetLearningViewport();
  };

  const handleTopicSelect = async (topicId: string) => {
    resetTopicEditorState();
    setSelectedTopicId(topicId);
    setError(null);
    resetLearningViewport();

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

  const handleStartTopicEditing = () => {
    if (!selectedTopicDetail) {
      return;
    }

    if (!isLocalLearningAdmin) {
      setTopicEditorError("Sign in as the local admin user to edit learning content.");
      setTopicEditorSuccess(null);
      return;
    }

    setTopicEditorText(toEditorParagraphsText(selectedTopicDetail.readingParagraphs));
    setPendingEditorFigures([]);
    setTopicEditorError(null);
    setTopicEditorSuccess(null);
    setIsTopicEditing(true);
  };

  const handleCancelTopicEditing = () => {
    setIsTopicEditing(false);
    setTopicEditorSaving(false);
    setTopicEditorError(null);
    setTopicEditorSuccess(null);
  };

  const captureEditorInsertRange = () => {
    const textarea = topicEditorTextareaRef.current;
    topicEditorInsertRangeRef.current = textarea
      ? {
          start: textarea.selectionStart,
          end: textarea.selectionEnd
        }
      : {
          start: topicEditorText.length,
          end: topicEditorText.length
        };
  };

  const openEmptyImageDraft = () => {
    captureEditorInsertRange();
    setImageDraft({
      id: buildEditorFigureId(selectedTopicDetail, pendingEditorFigures),
      caption: "",
      description: "",
      reference: ""
    });
    setImageDraftError(null);
    setImageDraftOpen(true);
  };

  const loadImageDraftFromFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImageDraftError("Paste or upload an image file.");
      return;
    }

    setImageDraftLoading(true);
    setImageDraftError(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const dimensions = await loadBrowserImageDimensions(dataUrl).catch(() => null);
      setImageDraft((current) => ({
        id: current?.id || buildEditorFigureId(selectedTopicDetail, pendingEditorFigures),
        caption: current?.caption ?? "",
        description: current?.description ?? "",
        reference: current?.reference ?? "",
        dataUrl,
        fileName: file.name,
        ...(dimensions ?? {})
      }));
      setImageDraftOpen(true);
    } catch (imageError) {
      setImageDraftError(imageError instanceof Error ? imageError.message : "Unable to load pasted image.");
    } finally {
      setImageDraftLoading(false);
    }
  };

  const handleTopicEditorPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFile = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (!imageFile) {
      return;
    }

    event.preventDefault();
    captureEditorInsertRange();
    setImageDraft({
      id: buildEditorFigureId(selectedTopicDetail, pendingEditorFigures),
      caption: "",
      description: "",
      reference: ""
    });
    void loadImageDraftFromFile(imageFile);
  };

  const handleImageDraftPaste = (event: ClipboardEvent<HTMLElement>) => {
    const imageFile = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (!imageFile) {
      return;
    }

    event.preventDefault();
    void loadImageDraftFromFile(imageFile);
  };

  const insertFigureMarkerAtEditorCursor = (figureId: string) => {
    const marker = `[[figure:${figureId}]]`;
    const range = topicEditorInsertRangeRef.current ?? {
      start: topicEditorText.length,
      end: topicEditorText.length
    };
    const before = topicEditorText.slice(0, range.start);
    const after = topicEditorText.slice(range.end);
    const prefix = before.length === 0 || before.endsWith("\n\n") ? "" : "\n\n";
    const suffix = after.length === 0 || after.startsWith("\n\n") ? "" : "\n\n";
    const nextText = `${before}${prefix}${marker}${suffix}${after}`;

    setTopicEditorText(nextText);
    window.requestAnimationFrame(() => {
      const textarea = topicEditorTextareaRef.current;
      if (!textarea) {
        return;
      }

      const cursor = before.length + prefix.length + marker.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleConfirmImageDraft = () => {
    if (!imageDraft) {
      return;
    }

    const id = sanitizeEditorFigureId(imageDraft.id);
    if (!id) {
      setImageDraftError("Add a short image reference id.");
      return;
    }

    if (!imageDraft.dataUrl && !imageDraft.src?.trim()) {
      setImageDraftError("Paste an image or provide an existing /learning image path.");
      return;
    }

    const figure: PendingEditorFigure = {
      id,
      caption: imageDraft.caption.trim(),
      description: imageDraft.description.trim(),
      reference: imageDraft.reference.trim(),
      ...(imageDraft.dataUrl ? { dataUrl: imageDraft.dataUrl } : {}),
      ...(imageDraft.src?.trim() ? { src: imageDraft.src.trim() } : {}),
      ...(imageDraft.page ? { page: imageDraft.page } : {}),
      ...(imageDraft.width ? { width: imageDraft.width } : {}),
      ...(imageDraft.height ? { height: imageDraft.height } : {})
    };

    setPendingEditorFigures((current) => [...current.filter((entry) => entry.id !== id), figure]);
    insertFigureMarkerAtEditorCursor(id);
    setImageDraftOpen(false);
    setImageDraft(null);
    setImageDraftError(null);
  };

  const handleSaveTopicEditing = async () => {
    if (!selectedTrackId || !selectedSubjectId || !selectedTopicId) {
      return;
    }

    if (!topicEditorText.trim()) {
      setTopicEditorError("Edited content is empty. Add text before saving.");
      setTopicEditorSuccess(null);
      return;
    }

    setTopicEditorSaving(true);
    setTopicEditorError(null);
    setTopicEditorSuccess(null);

    try {
      const response = await fetch("/api/learning/topic", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          track: selectedTrackId,
          subjectId: selectedSubjectId,
          topicId: selectedTopicId,
          readingText: topicEditorText,
          figures: pendingEditorFigures
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | TopicDetail
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("topicId" in payload)) {
        throw new Error(
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to save topic content."
        );
      }

      setTopicDetailsById((current) => ({
        ...current,
        [payload.topicId]: payload
      }));
      setIsTopicEditing(false);
      setPendingEditorFigures([]);
      setTopicEditorSuccess("Saved to minified JSON.");
    } catch (saveError) {
      setTopicEditorError(saveError instanceof Error ? saveError.message : "Unable to save topic content.");
    } finally {
      setTopicEditorSaving(false);
    }
  };

  return (
    <div className="page-stack">
      {error ? <p className="settings-feedback error">{error}</p> : null}
      {!selectedTrack && !loading ? (
        <section className="career-card learning-ai-plan-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">AI Study Plan</p>
              <h2>What should I study first?</h2>
              <p>
                {practiceAttemptsLoading
                  ? "Checking your test history..."
                  : completedAttempts.length > 0
                    ? "Career Intelligence reads your submitted test results and points you at the curriculum subjects worth the most right now."
                    : "You haven't submitted any practice tests yet. Career Intelligence will build a full path from the basics to the advanced material instead."}
              </p>
            </div>
            <Wand2 size={18} />
          </div>

          {learningPlanError ? <p className="settings-feedback error">{learningPlanError}</p> : null}

          {!learningPlanRequested ? (
            <button
              className="primary-button learning-ai-plan-trigger"
              disabled={practiceAttemptsLoading}
              onClick={() => void handleGenerateLearningPlan()}
              type="button"
            >
              <Wand2 size={15} />
              Generate My Study Plan
            </button>
          ) : learningPlanLoading ? (
            <div className="empty-drop">
              <Loader2 className="spin" size={16} />
              Analyzing your curriculum and test history...
            </div>
          ) : learningPlan ? (
            <div className="learning-ai-plan-body">
              <p className="learning-ai-plan-summary">{learningPlan.summary}</p>
              <ol className="learning-ai-plan-list">
                {learningPlan.modules.map((module, index) => (
                  <li className="learning-ai-plan-module" key={`${module.trackId}-${module.subjectId}`}>
                    <span className="learning-ai-plan-index">{index + 1}</span>
                    <div className="learning-ai-plan-module-body">
                      <div className="learning-ai-plan-module-head">
                        <strong>{module.subjectTitle}</strong>
                        <span className="pill brand">{module.trackTitle}</span>
                      </div>
                      <p>{module.reason}</p>
                      <span className="learning-ai-plan-module-meta">{module.topicCount} subtopics</span>
                    </div>
                    <button
                      className="ghost-button learning-ai-plan-module-open"
                      onClick={() => handleOpenPlanModule(module)}
                      type="button"
                    >
                      Start
                      <ArrowRight size={14} />
                    </button>
                  </li>
                ))}
              </ol>
              <button
                className="ghost-button learning-ai-plan-regenerate"
                disabled={learningPlanLoading}
                onClick={() => void handleGenerateLearningPlan()}
                type="button"
              >
                <Wand2 size={14} />
                Regenerate plan
              </button>
            </div>
          ) : (
            <button
              className="ghost-button learning-ai-plan-trigger"
              onClick={() => void handleGenerateLearningPlan()}
              type="button"
            >
              <Wand2 size={15} />
              Try again
            </button>
          )}
        </section>
      ) : null}
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
                            : "Read detailed explanations, examples, and references."}
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

                  {selectedTopicDetail.readingParagraphs.length > 0 ? (
                    <section className="learning-topic-block">
                      <div className="learning-topic-block-head">
                        <h3>Detailed Reading</h3>
                        <div className="learning-topic-editor-actions">
                          {isLocalLearningAdmin ? (
                            <>
                              <span className="learning-admin-status">
                                <ShieldCheck size={13} />
                                Admin
                              </span>
                              {isTopicEditing ? (
                                <>
                                  <button
                                    className="ghost-button"
                                    disabled={topicEditorSaving}
                                    onClick={openEmptyImageDraft}
                                    type="button"
                                  >
                                    <ImagePlus size={14} />
                                    Image
                                  </button>
                                  <button
                                    className="ghost-button"
                                    disabled={topicEditorSaving}
                                    onClick={() => void handleSaveTopicEditing()}
                                    type="button"
                                  >
                                    {topicEditorSaving ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
                                    Save
                                  </button>
                                  <button
                                    aria-label="Cancel editing"
                                    className="ghost-button"
                                    disabled={topicEditorSaving}
                                    onClick={handleCancelTopicEditing}
                                    type="button"
                                  >
                                    <X size={14} />
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  aria-label="Edit topic content"
                                  className="ghost-button learning-topic-edit-button"
                                  onClick={handleStartTopicEditing}
                                  title="Edit topic content"
                                  type="button"
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                            </>
                          ) : null}
                        </div>
                      </div>

                      {topicEditorError ? <p className="settings-feedback error">{topicEditorError}</p> : null}
                      {topicEditorSuccess ? <p className="settings-feedback success">{topicEditorSuccess}</p> : null}

                      {isTopicEditing ? (
                        <div className="learning-topic-editor-panel">
                          <p className="learning-topic-editor-note">
                            Editing mode is plain text. Add blank lines between paragraphs. Use image markers like
                            {" "}
                            <code>[[figure:my-figure-id]]</code>
                            {" "}
                            where the image should appear.
                          </p>
                          <textarea
                            className="learning-topic-editor-textarea"
                            onChange={(event) => setTopicEditorText(event.target.value)}
                            onPaste={handleTopicEditorPaste}
                            ref={topicEditorTextareaRef}
                            spellCheck={false}
                            value={topicEditorText}
                          />

                          {pendingEditorFigures.length > 0 ? (
                            <div className="learning-topic-editor-refs">
                              <h4>Pending Images</h4>
                              <ul>
                                {pendingEditorFigures.map((figure) => (
                                  <li key={`pending-topic-figure-ref-${figure.id}`}>
                                    <strong>{figure.id}</strong>
                                    {figure.caption ? ` - ${figure.caption}` : ""}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {selectedTopicDetail.figures.length > 0 ? (
                            <div className="learning-topic-editor-refs">
                              <h4>Image References</h4>
                              <ul>
                                {selectedTopicDetail.figures.map((figure, index) => (
                                  <li key={`topic-figure-ref-${figure.id}`}>
                                    <a href={learningAssetUrl(figure.src)} rel="noopener noreferrer" target="_blank">
                                      {figure.caption || `Image ${index + 1}`}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="learning-topic-paragraphs">
                          {buildReadingTimeline(selectedTopicDetail)}
                        </div>
                      )}
                    </section>
                  ) : null}

                  {selectedTopicDetail.referenceGroups.map((group) => (
                    <section className="learning-topic-block" key={group.id}>
                      <h3>{group.title}</h3>
                      <p className="learning-reference-intro">
                        For further reference to this topic, refer to the links below.
                      </p>
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
                </div>
              ) : (
                <div className="empty-drop">Open a subtopic card to load full reading material.</div>
              )}
            </article>
          )}
        </section>
      )}
      {imageDraftOpen && imageDraft ? (
        <div
          className="learning-editor-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Add learning image"
          onPaste={handleImageDraftPaste}
        >
          <div className="learning-editor-modal learning-image-modal">
            <div className="learning-editor-modal-head">
              <div>
                <p className="eyebrow">Image</p>
                <h3>Add Figure Reference</h3>
              </div>
              <button
                aria-label="Close image editor"
                className="ghost-button learning-topic-edit-button"
                onClick={() => {
                  setImageDraftOpen(false);
                  setImageDraft(null);
                  setImageDraftError(null);
                }}
                type="button"
              >
                <X size={14} />
              </button>
            </div>

            {imageDraftError ? <p className="settings-feedback error">{imageDraftError}</p> : null}

            <div className="learning-image-paste-zone" tabIndex={0}>
              {imageDraft.dataUrl || imageDraft.src ? (
                <div className="learning-image-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Pending learning figure preview"
                    src={imageDraft.dataUrl || learningAssetUrl(imageDraft.src ?? "")}
                  />
                  <span>{imageDraft.fileName || imageDraft.src || "Pasted image"}</span>
                </div>
              ) : (
                <>
                  <Upload size={18} />
                  <span>Paste an image here</span>
                </>
              )}
            </div>

            <label className="learning-editor-field">
              <span>Upload image</span>
              <input
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void loadImageDraftFromFile(file);
                  }
                }}
                type="file"
              />
            </label>

            <label className="learning-editor-field">
              <span>Existing image path</span>
              <input
                onChange={(event) =>
                  setImageDraft((current) =>
                    current
                      ? {
                          ...current,
                          src: event.target.value,
                          dataUrl: event.target.value.trim() ? undefined : current.dataUrl
                        }
                      : current
                  )
                }
                placeholder="/learning/admin-uploads/..."
                value={imageDraft.src ?? ""}
              />
            </label>

            <label className="learning-editor-field">
              <span>Image reference id</span>
              <input
                onChange={(event) =>
                  setImageDraft((current) =>
                    current
                      ? {
                          ...current,
                          id: event.target.value
                        }
                      : current
                  )
                }
                value={imageDraft.id}
              />
            </label>

            <label className="learning-editor-field">
              <span>Reference label</span>
              <input
                onChange={(event) =>
                  setImageDraft((current) =>
                    current
                      ? {
                          ...current,
                          reference: event.target.value
                        }
                      : current
                  )
                }
                placeholder="Figure 2.1"
                value={imageDraft.reference}
              />
            </label>

            <label className="learning-editor-field">
              <span>Caption</span>
              <input
                onChange={(event) =>
                  setImageDraft((current) =>
                    current
                      ? {
                          ...current,
                          caption: event.target.value
                        }
                      : current
                  )
                }
                placeholder="Short visible caption"
                value={imageDraft.caption}
              />
            </label>

            <label className="learning-editor-field">
              <span>What this image stands for</span>
              <textarea
                onChange={(event) =>
                  setImageDraft((current) =>
                    current
                      ? {
                          ...current,
                          description: event.target.value
                        }
                      : current
                  )
                }
                value={imageDraft.description}
              />
            </label>

            <div className="modal-actions">
              <button
                className="ghost-button"
                onClick={() => {
                  setImageDraftOpen(false);
                  setImageDraft(null);
                  setImageDraftError(null);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={imageDraftLoading}
                onClick={handleConfirmImageDraft}
                type="button"
              >
                {imageDraftLoading ? <Loader2 className="spin" size={14} /> : <ImagePlus size={14} />}
                Insert
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
