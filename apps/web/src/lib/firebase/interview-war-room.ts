"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";
import { fetchInterviewTestTemplateWithQuestions, fetchMcqReview } from "@/lib/interview/client";
import {
  formatInterviewTestType,
  getInterviewTrack,
  type InterviewTestTemplate,
  type InterviewTestType,
  type McqOptionId,
  type PracticeAttemptMode,
  type PracticeAttemptStatus,
  type PracticeMcqQuestion,
  type PracticeQuestion,
  type PracticeScore
} from "@/lib/interview/question-bank";

export type PracticeAttemptRecord = {
  answerKeyVersion: string;
  categories: string[];
  codingCompletion: Record<string, boolean>;
  codingNotes: Record<string, string>;
  createdAt: string;
  currentQuestionIndex: number;
  deadlineAt?: string;
  description: string;
  durationMinutes: number;
  id: string;
  mcqAnswers: Record<string, string>;
  mode: PracticeAttemptMode;
  questionCount: number;
  questionIds: string[];
  questions: PracticeQuestion[];
  score?: PracticeScore;
  startedAt?: string;
  status: PracticeAttemptStatus;
  submittedAt?: string;
  subtitle: string;
  testTemplateId?: string;
  testType: InterviewTestType;
  title: string;
  updatedAt: string;
  userId: string;
};

export type PracticeAttemptProgressPayload = {
  codingCompletion?: Record<string, boolean>;
  codingNotes?: Record<string, string>;
  currentQuestionIndex?: number;
  mcqAnswers?: Record<string, string>;
};

export type SubmitPracticeAttemptPayload = {
  codingCompletion: Record<string, boolean>;
  codingNotes: Record<string, string>;
  currentQuestionIndex: number;
  mcqAnswers: Record<string, string>;
  timedOut?: boolean;
};

const ATTEMPT_STATUS_VALUES = new Set<PracticeAttemptStatus>(["ready", "in_progress", "submitted", "timed_out"]);
const ATTEMPT_MODE_VALUES = new Set<PracticeAttemptMode>(["mcq", "coding"]);
const TEST_TYPE_VALUES = new Set<InterviewTestType>(["coding", "aptitude", "computer-science", "ai"]);

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asIsoString(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      const date = value.toDate() as Date;
      return Number.isFinite(date.getTime()) ? date.toISOString() : "";
    } catch {
      return "";
    }
  }

  return "";
}

function asInteger(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
  }

  return fallback;
}

function asStringArray(value: unknown, max = 100): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asString(entry))
    .filter(Boolean)
    .slice(0, max);
}

function asStringMap(value: unknown, max = 600): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, entryValue]) => [asString(key), asString(entryValue)] as const)
    .filter(([key]) => Boolean(key))
    .slice(0, max);

  return Object.fromEntries(entries);
}

function asBooleanMap(value: unknown, max = 600): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, entryValue]) => [asString(key), entryValue === true] as const)
    .filter(([key]) => Boolean(key))
    .slice(0, max);

  return Object.fromEntries(entries);
}

function isValidOptionId(value: string): value is McqOptionId {
  return value === "a" || value === "b" || value === "c" || value === "d";
}

function parseQuestion(entry: unknown, index: number): PracticeQuestion | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const data = entry as Record<string, unknown>;
  const kind = asString(data.kind);
  const id = asString(data.id) || `question_${index + 1}`;
  const prompt = asString(data.prompt) || `Question ${index + 1}`;
  const category = asString(data.category) || "General";
  const imageUrl = asString(data.imageUrl) || undefined;
  const imageAlt = asString(data.imageAlt) || undefined;
  const imageSourceUrl = asString(data.imageSourceUrl) || undefined;

  if (kind === "mcq") {
    const optionsRaw = Array.isArray(data.options) ? data.options : [];
    const options = optionsRaw
      .map((option, optionIndex) => {
        if (!option || typeof option !== "object") {
          return null;
        }

        const optionRecord = option as Record<string, unknown>;
        const idCandidate = asString(optionRecord.id).toLowerCase();
        const optionId = isValidOptionId(idCandidate)
          ? idCandidate
          : optionIndex === 0
            ? "a"
            : optionIndex === 1
              ? "b"
              : optionIndex === 2
                ? "c"
                : "d";

        const optionText = asString(optionRecord.text);
        if (!optionText) {
          return null;
        }

        return {
          id: optionId,
          text: optionText
        };
      })
      .filter((option): option is { id: McqOptionId; text: string } => Boolean(option))
      .slice(0, 4);

    if (options.length === 0) {
      return null;
    }

    const difficultyCandidate = asString(data.difficulty);

    return {
      id,
      kind: "mcq",
      category,
      prompt,
      imageUrl,
      imageAlt,
      imageSourceUrl,
      options,
      difficulty:
        difficultyCandidate === "easy" || difficultyCandidate === "medium" || difficultyCandidate === "hard"
          ? difficultyCandidate
          : undefined
    };
  }

  const difficultyCandidate = asString(data.difficulty);

  return {
    id,
    kind: "coding",
    category,
    prompt,
    imageUrl,
    imageAlt,
    imageSourceUrl,
    difficulty:
      difficultyCandidate === "easy" || difficultyCandidate === "medium" || difficultyCandidate === "hard"
        ? difficultyCandidate
        : "medium",
    inputFormat: asString(data.inputFormat) || "Input format is provided in prompt.",
    outputFormat: asString(data.outputFormat) || "Output format is provided in prompt.",
    constraints: asStringArray(data.constraints, 12),
    sampleInput: asString(data.sampleInput),
    sampleOutput: asString(data.sampleOutput),
    hints: asStringArray(data.hints, 8)
  };
}

function asPracticeQuestions(value: unknown): PracticeQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => parseQuestion(entry, index))
    .filter((entry): entry is PracticeQuestion => Boolean(entry))
    .slice(0, 120);
}

function asScore(value: unknown): PracticeScore | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const data = value as Record<string, unknown>;
  const total = Math.max(0, asInteger(data.total, 0));
  const correct = Math.max(0, asInteger(data.correct, 0));
  const answered = Math.max(0, asInteger(data.answered, 0));
  const percentage = Math.max(0, Math.min(100, asInteger(data.percentage, 0)));

  return {
    total,
    correct,
    answered,
    percentage
  };
}

function parsePracticeAttempt(snapshot: QueryDocumentSnapshot<DocumentData>): PracticeAttemptRecord {
  const data = snapshot.data() as Record<string, unknown>;
  const testTypeCandidate = asString(data.testType) as InterviewTestType;
  const modeCandidate = asString(data.mode) as PracticeAttemptMode;
  const statusCandidate = asString(data.status) as PracticeAttemptStatus;
  const createdAt = asIsoString(data.createdAt) || new Date().toISOString();
  const updatedAt = asIsoString(data.updatedAt) || createdAt;
  const testType = TEST_TYPE_VALUES.has(testTypeCandidate) ? testTypeCandidate : "aptitude";
  const mode = ATTEMPT_MODE_VALUES.has(modeCandidate) ? modeCandidate : getInterviewTrack(testType).mode;
  const subtitle = asString(data.subtitle) || getInterviewTrack(testType).subtitle;
  const testTemplateId = asString(data.testTemplateId) || undefined;

  const questionIds = asStringArray(data.questionIds, 300);
  // Attempts created via createPracticeAttempt() below always embed their full `questions` array in the Firestore
  // doc (mirrors apps/mobile/src/lib/practiceAttempts.ts's createPracticeAttempt()), so this is normally always
  // populated. There used to be a fallback here that reconstructed questions one-by-one from bare questionIds via
  // getPracticeQuestionById() - that function is now async (question content is fetched from R2 server-side) and
  // can't run inside this synchronous Firestore snapshot parser, so the fallback was dropped. Only affects attempt
  // records created before this migration that stored questionIds without embedded questions - those will show as
  // having 0 questions. Known gap; flagged for manual backfill if any such records exist.
  const parsedQuestions = asPracticeQuestions(data.questions);
  const fallbackQuestionCount = parsedQuestions.length;

  return {
    id: asString(data.id) || snapshot.id,
    userId: asString(data.userId),
    testType,
    mode,
    title: asString(data.title) || `${formatInterviewTestType(testType)} Test`,
    subtitle,
    testTemplateId,
    description: asString(data.description),
    durationMinutes: Math.max(1, asInteger(data.durationMinutes, getInterviewTrack(testType).durationMinutes)),
    questionCount: Math.max(1, asInteger(data.questionCount, fallbackQuestionCount || getInterviewTrack(testType).questionCount)),
    questionIds: questionIds.length > 0 ? questionIds : parsedQuestions.map((question) => question.id),
    categories: asStringArray(data.categories, 20),
    questions: parsedQuestions,
    status: ATTEMPT_STATUS_VALUES.has(statusCandidate) ? statusCandidate : "ready",
    createdAt,
    updatedAt,
    startedAt: asIsoString(data.startedAt) || undefined,
    deadlineAt: asIsoString(data.deadlineAt) || undefined,
    submittedAt: asIsoString(data.submittedAt) || undefined,
    currentQuestionIndex: Math.max(0, asInteger(data.currentQuestionIndex, 0)),
    mcqAnswers: asStringMap(data.mcqAnswers),
    codingNotes: asStringMap(data.codingNotes),
    codingCompletion: asBooleanMap(data.codingCompletion),
    answerKeyVersion: asString(data.answerKeyVersion) || "unknown",
    score: asScore(data.score)
  };
}

function sortAttemptsByCreatedAtDescending(attempts: PracticeAttemptRecord[]): PracticeAttemptRecord[] {
  return [...attempts].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
}

function sanitizeQuestionIndex(value: number | undefined, questionCount: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const maxIndex = Math.max(0, questionCount - 1);
  return Math.max(0, Math.min(maxIndex, Math.round(value)));
}

function sanitizeMcqAnswers(value: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([questionId, optionId]) => [asString(questionId), asString(optionId).toLowerCase()] as const)
    .filter(([questionId, optionId]) => Boolean(questionId && isValidOptionId(optionId)))
    .slice(0, 600);

  return Object.fromEntries(entries);
}

function sanitizeCodingNotes(value: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([questionId, note]) => [asString(questionId), asString(note)] as const)
    .filter(([questionId]) => Boolean(questionId))
    .slice(0, 600);

  return Object.fromEntries(entries);
}

function sanitizeCodingCompletion(value: Record<string, boolean> | undefined): Record<string, boolean> | undefined {
  if (!value) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([questionId, completed]) => [asString(questionId), completed === true] as const)
    .filter(([questionId]) => Boolean(questionId))
    .slice(0, 600);

  return Object.fromEntries(entries);
}

export function useUserPracticeAttempts() {
  const hasAuth = Boolean(auth);
  const hasDb = Boolean(db);
  const [attempts, setAttempts] = useState<PracticeAttemptRecord[]>([]);
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [loading, setLoading] = useState(hasAuth && hasDb);
  const [error, setError] = useState<string | null>(
    !hasAuth ? "Firebase authentication is not configured." : !hasDb ? "Firestore is not configured." : null
  );

  useEffect(() => {
    const firebaseAuth = auth;
    const firestore = db;

    if (!firebaseAuth || !firestore) {
      return;
    }

    let unsubscribeAttempts: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (authUser) => {
      if (unsubscribeAttempts) {
        unsubscribeAttempts();
        unsubscribeAttempts = null;
      }

      setUser(authUser);

      if (!authUser) {
        setAttempts([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      unsubscribeAttempts = onSnapshot(
        collection(firestore, "users", authUser.uid, "practiceAttempts"),
        (snapshot) => {
          const parsedAttempts = snapshot.docs.map((docSnapshot) => parsePracticeAttempt(docSnapshot));
          setAttempts(sortAttemptsByCreatedAtDescending(parsedAttempts));
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          setAttempts([]);
          setLoading(false);
          setError(snapshotError.message || "Failed to load practice attempts.");
        }
      );
    });

    return () => {
      if (unsubscribeAttempts) {
        unsubscribeAttempts();
      }

      unsubscribeAuth();
    };
  }, []);

  return {
    attempts,
    error,
    loading,
    user
  };
}

export function usePracticeAttempt(attemptId: string) {
  const hasAuth = Boolean(auth);
  const hasDb = Boolean(db);
  const [attempt, setAttempt] = useState<PracticeAttemptRecord | null>(null);
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [loading, setLoading] = useState(hasAuth && hasDb);
  const [error, setError] = useState<string | null>(
    !hasAuth ? "Firebase authentication is not configured." : !hasDb ? "Firestore is not configured." : null
  );

  useEffect(() => {
    const firebaseAuth = auth;
    const firestore = db;

    if (!firebaseAuth || !firestore) {
      return;
    }

    let unsubscribeAttempt: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (authUser) => {
      if (unsubscribeAttempt) {
        unsubscribeAttempt();
        unsubscribeAttempt = null;
      }

      setUser(authUser);

      if (!authUser || !attemptId) {
        setAttempt(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      unsubscribeAttempt = onSnapshot(
        doc(firestore, "users", authUser.uid, "practiceAttempts", attemptId),
        (snapshot) => {
          if (!snapshot.exists()) {
            setAttempt(null);
            setLoading(false);
            setError("Practice attempt not found.");
            return;
          }

          const parsedAttempt = parsePracticeAttempt(snapshot as QueryDocumentSnapshot<DocumentData>);
          setAttempt(parsedAttempt);
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          setAttempt(null);
          setLoading(false);
          setError(snapshotError.message || "Failed to load practice attempt.");
        }
      );
    });

    return () => {
      if (unsubscribeAttempt) {
        unsubscribeAttempt();
      }

      unsubscribeAuth();
    };
  }, [attemptId]);

  return {
    attempt,
    error,
    loading,
    user
  };
}

export async function createPracticeAttempt(
  userId: string,
  testType: InterviewTestType,
  testTemplateId?: string
): Promise<string> {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  const track = getInterviewTrack(testType);

  // Question content (compiled banks, AI role questions, computer-science tests) now lives in R2 and is fetched
  // server-side only (see lib/interview/question-bank.ts's ensureQuestionBankLoaded()), so buildPracticeAttemptSeed()
  // can no longer run in-browser - this fetches the same fully-built, answer-stripped question set from
  // /api/interview/templates/[templateId] instead. Mirrors apps/mobile/src/lib/practiceAttempts.ts's
  // createPracticeAttempt(), which was the reference implementation for this change - including always embedding
  // the full `questions` array in the Firestore doc (not just questionIds), since parsePracticeAttempt() above can
  // no longer reconstruct question content from bare ids on the fly either.
  let template: InterviewTestTemplate | undefined;
  let questions: PracticeQuestion[] = [];

  if (testTemplateId) {
    const result = await fetchInterviewTestTemplateWithQuestions(testType, testTemplateId);
    template = result.template;
    questions = result.questions;
  }

  const questionIds = questions.map((question) => question.id);
  const categories = Array.from(new Set(questions.map((question) => question.category))).slice(0, 12);
  const nowIso = new Date().toISOString();

  const attemptRef = await addDoc(collection(db, "users", userId, "practiceAttempts"), {
    userId,
    testType,
    mode: template?.mode ?? track.mode,
    title: template?.title ?? track.title,
    subtitle: template?.subtitle ?? track.subtitle,
    description: template?.summary ?? track.description,
    ...(template ? { testTemplateId: template.id } : {}),
    durationMinutes: template?.durationMinutes ?? track.durationMinutes,
    questionCount: template?.questionCount ?? track.questionCount,
    questionIds,
    questions,
    categories,
    answerKeyVersion: "v1",
    status: "ready",
    createdAt: nowIso,
    updatedAt: nowIso,
    currentQuestionIndex: 0,
    mcqAnswers: {},
    codingNotes: {},
    codingCompletion: {}
  });

  await updateDoc(attemptRef, { id: attemptRef.id });

  return attemptRef.id;
}

export async function startPracticeAttempt(userId: string, attempt: PracticeAttemptRecord) {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  if (attempt.status === "submitted" || attempt.status === "timed_out") {
    return {
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt
    };
  }

  const startedAt = attempt.startedAt ?? new Date().toISOString();
  const parsedStart = Date.parse(startedAt);
  const deadlineAt =
    attempt.deadlineAt ??
    new Date((Number.isFinite(parsedStart) ? parsedStart : Date.now()) + attempt.durationMinutes * 60_000).toISOString();

  await updateDoc(doc(db, "users", userId, "practiceAttempts", attempt.id), {
    status: "in_progress",
    startedAt,
    deadlineAt,
    updatedAt: new Date().toISOString()
  });

  return {
    startedAt,
    deadlineAt
  };
}

export async function savePracticeAttemptProgress(
  userId: string,
  attemptId: string,
  questionCount: number,
  payload: PracticeAttemptProgressPayload
) {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString()
  };

  const safeIndex = sanitizeQuestionIndex(payload.currentQuestionIndex, questionCount);
  if (typeof safeIndex === "number") {
    updates.currentQuestionIndex = safeIndex;
  }

  const safeMcqAnswers = sanitizeMcqAnswers(payload.mcqAnswers);
  if (safeMcqAnswers) {
    updates.mcqAnswers = safeMcqAnswers;
  }

  const safeCodingNotes = sanitizeCodingNotes(payload.codingNotes);
  if (safeCodingNotes) {
    updates.codingNotes = safeCodingNotes;
  }

  const safeCodingCompletion = sanitizeCodingCompletion(payload.codingCompletion);
  if (safeCodingCompletion) {
    updates.codingCompletion = safeCodingCompletion;
  }

  await updateDoc(doc(db, "users", userId, "practiceAttempts", attemptId), updates);
}

export async function submitPracticeAttempt(
  userId: string,
  attempt: PracticeAttemptRecord,
  payload: SubmitPracticeAttemptPayload
): Promise<PracticeScore> {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  // scorePracticeMcqResponses() used to run in-browser against the bundled answer key - that's no longer possible
  // (question content, including correctOptionId, is fetched from R2 server-side only), so scoring now goes
  // through /api/interview/mcq-review, exactly like apps/mobile/src/lib/practiceAttempts.ts's
  // submitPracticeAttempt().
  const mcqQuestionIds = attempt.questions
    .filter((question): question is PracticeMcqQuestion => question.kind === "mcq")
    .map((question) => question.id);
  const { score } =
    mcqQuestionIds.length > 0
      ? await fetchMcqReview(mcqQuestionIds, payload.mcqAnswers)
      : { score: { total: 0, correct: 0, answered: 0, percentage: 0 } };
  const nowIso = new Date().toISOString();

  await updateDoc(doc(db, "users", userId, "practiceAttempts", attempt.id), {
    status: payload.timedOut ? "timed_out" : "submitted",
    submittedAt: nowIso,
    updatedAt: nowIso,
    currentQuestionIndex: sanitizeQuestionIndex(payload.currentQuestionIndex, attempt.questions.length) ?? 0,
    mcqAnswers: sanitizeMcqAnswers(payload.mcqAnswers) ?? {},
    codingNotes: sanitizeCodingNotes(payload.codingNotes) ?? {},
    codingCompletion: sanitizeCodingCompletion(payload.codingCompletion) ?? {},
    score,
    ...(attempt.deadlineAt ? {} : { deadlineAt: nowIso }),
    ...(attempt.startedAt ? {} : { startedAt: nowIso })
  });

  return score;
}
