import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { firestoreCollections } from "./collections";
import type {
  AiInterviewRole,
  InterviewTestTemplate,
  InterviewTestType,
  McqReviewEntry,
  PracticeAttemptRecord,
  PracticeQuestion
} from "../types/practiceAttempt";
import { apiGet, apiPost } from "./apiClient";

// Re-exported so screens can do `import { useUserPracticeAttempts, type PracticeAttemptRecord } from
// "../../lib/practiceAttempts"` in one line instead of also reaching into ../../types/practiceAttempt.
export type { AiInterviewRole, InterviewTestTemplate, InterviewTestType, McqReviewEntry, PracticeAttemptRecord, PracticeQuestion };

/** Lists a track's compiled test templates - see apps/web/src/app/api/interview/templates/route.ts. For the "ai"
 *  track, pass the selected role's id so the right 100-test catalog comes back. */
export async function fetchTemplateLibrary(testType: InterviewTestType, roleId?: string): Promise<InterviewTestTemplate[]> {
  const params = new URLSearchParams({ testType });
  if (roleId) params.set("roleId", roleId);
  const result = await apiGet<{ templates: InterviewTestTemplate[] }>(`/api/interview/templates?${params.toString()}`);
  return result.templates;
}

/** Lists the 20 AI role tracks - see apps/web/src/app/api/interview/ai-roles/route.ts. */
export async function fetchAiRoles(): Promise<AiInterviewRole[]> {
  const result = await apiGet<{ roles: AiInterviewRole[] }>("/api/interview/ai-roles");
  return result.roles;
}

/** Mirrors apps/web/src/lib/firebase/interview-war-room.ts. */
export function useUserPracticeAttempts(userId: string | undefined) {
  const [attempts, setAttempts] = useState<PracticeAttemptRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setAttempts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const attemptsQuery = query(
      collection(db, "users", userId, firestoreCollections.practiceAttempts),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(
      attemptsQuery,
      (snapshot) => {
        setAttempts(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PracticeAttemptRecord));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [userId]);

  return { attempts, loading };
}

export function usePracticeAttempt(userId: string | undefined, attemptId: string | undefined) {
  const [attempt, setAttempt] = useState<PracticeAttemptRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !attemptId) {
      setAttempt(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, "users", userId, firestoreCollections.practiceAttempts, attemptId),
      (snapshot) => {
        setAttempt(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as PracticeAttemptRecord) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [userId, attemptId]);

  return { attempt, loading };
}

/** Fetches a fully-built template (with embedded questions) from the web app's new /api/interview/templates route -
 *  see apps/web/src/app/api/interview/templates/[templateId]/route.ts. This wraps the same pure question-bank.ts
 *  functions the web app already uses client-side, just exposed over HTTP so mobile doesn't need to bundle the
 *  ~6.8MB of compiled question JSON into the app. */
async function fetchTemplateQuestions(
  testType: string,
  templateId: string,
  roleId?: string
): Promise<{ template: InterviewTestTemplate; questions: PracticeQuestion[] }> {
  const params = new URLSearchParams({ testType });
  if (roleId) params.set("roleId", roleId);
  return apiGet(`/api/interview/templates/${encodeURIComponent(templateId)}?${params.toString()}`);
}

export async function createPracticeAttempt(
  userId: string,
  testType: string,
  templateId: string,
  roleId?: string
): Promise<string> {
  const { template, questions } = await fetchTemplateQuestions(testType, templateId, roleId);
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, "users", userId, firestoreCollections.practiceAttempts), {
    userId,
    testType: template.testType,
    mode: template.mode,
    title: template.title,
    subtitle: template.subtitle,
    testTemplateId: template.id,
    description: template.summary,
    durationMinutes: template.durationMinutes,
    questionCount: template.questionCount,
    questionIds: questions.map((q) => q.id),
    categories: template.categoryFocus,
    questions,
    status: "ready",
    createdAt: now,
    updatedAt: now,
    currentQuestionIndex: 0,
    mcqAnswers: {},
    codingNotes: {},
    codingCompletion: {},
    answerKeyVersion: "v1"
  });
  return docRef.id;
}

export async function startPracticeAttempt(userId: string, attempt: PracticeAttemptRecord): Promise<void> {
  const now = new Date().toISOString();
  const deadline = new Date(Date.now() + attempt.durationMinutes * 60_000).toISOString();
  await updateDoc(doc(db, "users", userId, firestoreCollections.practiceAttempts, attempt.id), {
    status: "in_progress",
    startedAt: now,
    deadlineAt: deadline,
    updatedAt: now
  });
}

export async function savePracticeAttemptProgress(
  userId: string,
  attemptId: string,
  updates: {
    currentQuestionIndex: number;
    mcqAnswers: Record<string, string>;
    codingNotes: Record<string, string>;
    codingCompletion: Record<string, boolean>;
  }
): Promise<void> {
  await updateDoc(doc(db, "users", userId, firestoreCollections.practiceAttempts, attemptId), {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

/** Scores MCQ answers and returns the canonical correct option + explanation per question, entirely server-side -
 *  see apps/web/src/app/api/interview/mcq-review/route.ts. Mobile never holds the answer key locally (no bundled
 *  question bank), so both submit-time scoring and post-submit review go through this one endpoint. */
export async function fetchMcqReview(
  questionIds: string[],
  mcqAnswers: Record<string, string>
): Promise<{ score: { total: number; correct: number; answered: number; percentage: number }; reviews: Record<string, McqReviewEntry> }> {
  return apiPost("/api/interview/mcq-review", { questionIds, mcqAnswers });
}

export async function submitPracticeAttempt(
  userId: string,
  attempt: PracticeAttemptRecord,
  updates: {
    mcqAnswers: Record<string, string>;
    codingNotes: Record<string, string>;
    codingCompletion: Record<string, boolean>;
    currentQuestionIndex: number;
    timedOut?: boolean;
  }
): Promise<{ reviews: Record<string, McqReviewEntry> }> {
  const mcqQuestionIds = attempt.questions.filter((q): q is PracticeQuestion & { kind: "mcq" } => q.kind === "mcq").map((q) => q.id);
  const { score, reviews } =
    mcqQuestionIds.length > 0
      ? await fetchMcqReview(mcqQuestionIds, updates.mcqAnswers)
      : { score: { total: 0, correct: 0, answered: 0, percentage: 0 }, reviews: {} };
  const now = new Date().toISOString();
  await updateDoc(doc(db, "users", userId, firestoreCollections.practiceAttempts, attempt.id), {
    ...updates,
    score,
    status: updates.timedOut ? "timed_out" : "submitted",
    submittedAt: now,
    updatedAt: now
  });
  return { reviews };
}

export async function getAttemptDoc(userId: string, attemptId: string): Promise<PracticeAttemptRecord | null> {
  const snapshot = await getDoc(doc(db, "users", userId, firestoreCollections.practiceAttempts, attemptId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as PracticeAttemptRecord) : null;
}
