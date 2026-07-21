import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { restGetDocument, restListDocuments, restSetDocument } from "@/lib/firebase/firestore-rest";
import { listAiInterviewRoles, type InterviewQuestionDifficulty, type InterviewTestType, type McqOption, type McqOptionId } from "./question-bank";

const COLLECTION = "customTestPapers";
const QUESTION_ID_SEPARATOR = "__ctpq__";

const DEFAULT_DURATION_MINUTES: Record<Exclude<InterviewTestType, "coding">, number> = {
  aptitude: 60,
  "computer-science": 60,
  ai: 90
};

const OPTION_IDS: McqOptionId[] = ["a", "b", "c", "d"];

export type CustomTestPaperQuestion = {
  category: string;
  correctOptionId: McqOptionId;
  difficulty?: InterviewQuestionDifficulty;
  explanation: string;
  id: string;
  options: McqOption[];
  prompt: string;
};

export type CustomTestPaperRecord = {
  categoryFocus: string[];
  createdAt: string;
  createdBy: string;
  durationMinutes: number;
  id: string;
  questions: CustomTestPaperQuestion[];
  roleId?: string;
  roleName?: string;
  subtitle: string;
  summary: string;
  testType: Exclude<InterviewTestType, "coding">;
  title: string;
  updatedAt: string;
};

/** What the admin UI sends for one question, either hand-typed or pasted as JSON. Options are plain strings
 *  (position implies a/b/c/d) so authoring a test paper by hand doesn't require thinking about option ids. */
export type CustomTestPaperQuestionInput = {
  category?: string;
  correctOptionIndex: number;
  difficulty?: InterviewQuestionDifficulty;
  explanation?: string;
  options: string[];
  prompt: string;
};

export type CustomTestPaperInput = {
  categoryFocus?: string[];
  durationMinutes?: number;
  id?: string;
  questions: CustomTestPaperQuestionInput[];
  roleId?: string;
  subtitle?: string;
  summary?: string;
  testType: string;
  title: string;
};

function requireIdTokenForRestFallback(idToken: string | undefined): string {
  if (!idToken) {
    throw new Error("Missing Firebase Admin environment variables.");
  }

  return idToken;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isValidTestType(value: string): value is Exclude<InterviewTestType, "coding"> {
  return value === "aptitude" || value === "computer-science" || value === "ai";
}

/** Validates and normalizes one admin-authored test paper into the stored record shape - shared by the single-save
 *  and bulk-import paths (bulk just calls this once per array entry). Throws with a human-readable message on any
 *  invalid input, since that message is shown directly in the admin UI. */
export function buildCustomTestPaperRecord(
  input: CustomTestPaperInput,
  context: { createdBy: string; existingCreatedAt?: string }
): CustomTestPaperRecord {
  if (!isValidTestType(input.testType)) {
    throw new Error('testType must be one of "aptitude", "computer-science", or "ai".');
  }

  const title = input.title?.trim();
  if (!title) {
    throw new Error("Title is required.");
  }

  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    throw new Error("Add at least one question.");
  }

  let roleId: string | undefined;
  let roleName: string | undefined;
  if (input.testType === "ai") {
    roleId = input.roleId?.trim();
    if (!roleId) {
      throw new Error("roleId is required for AI Technical test papers.");
    }
    const role = listAiInterviewRoles().find((candidate) => candidate.id === roleId);
    if (!role) {
      throw new Error(`Unknown AI role id "${roleId}". Check /api/interview/ai-roles for valid ids.`);
    }
    roleName = role.name;
  }

  const id = slugify(input.id?.trim() || `${input.testType}-${title}`);
  if (!id) {
    throw new Error("Unable to derive an id from the title - set one explicitly.");
  }

  const questions: CustomTestPaperQuestion[] = input.questions.map((question, index) => {
    const prompt = question.prompt?.trim();
    if (!prompt) {
      throw new Error(`Question ${index + 1}: prompt is required.`);
    }

    const optionTexts = (question.options ?? []).map((option) => option?.trim() ?? "");
    if (optionTexts.length !== 4 || optionTexts.some((text) => !text)) {
      throw new Error(`Question ${index + 1}: exactly 4 non-empty options are required.`);
    }

    const correctIndex = question.correctOptionIndex;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      throw new Error(`Question ${index + 1}: correctOptionIndex must be an integer from 0 to 3.`);
    }

    return {
      id: `${id}${QUESTION_ID_SEPARATOR}${index}`,
      kind: "mcq",
      category: question.category?.trim() || title,
      prompt,
      options: optionTexts.map((text, optionIndex) => ({ id: OPTION_IDS[optionIndex], text })),
      correctOptionId: OPTION_IDS[correctIndex],
      explanation: question.explanation?.trim() || "",
      difficulty: question.difficulty
    } satisfies CustomTestPaperQuestion & { kind: "mcq" };
  });

  const categoryFocus =
    input.categoryFocus && input.categoryFocus.length > 0
      ? input.categoryFocus
      : Array.from(new Set(questions.map((question) => question.category))).slice(0, 12);

  const now = new Date().toISOString();

  return {
    id,
    testType: input.testType,
    roleId,
    roleName,
    title,
    subtitle: input.subtitle?.trim() || `${questions.length} questions`,
    summary: input.summary?.trim() || `A custom ${title} test paper added from the admin tool.`,
    durationMinutes: input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : DEFAULT_DURATION_MINUTES[input.testType],
    categoryFocus,
    questions,
    createdBy: context.createdBy,
    createdAt: context.existingCreatedAt ?? now,
    updatedAt: now
  };
}

/** Parses the paper id back out of a question id built above, so review/scoring can find the source paper without
 *  a second collection. Returns null for question ids that don't belong to a custom paper at all. */
export function parseCustomQuestionId(questionId: string): { paperId: string } | null {
  const separatorIndex = questionId.indexOf(QUESTION_ID_SEPARATOR);
  if (separatorIndex === -1) {
    return null;
  }

  return { paperId: questionId.slice(0, separatorIndex) };
}

/**
 * Mirrors lib/coding-catalog/firestore.ts and lib/system-design/firestore.ts exactly: prefers the Firebase Admin
 * SDK (bypasses firestore.rules), falls back to Firestore REST authenticated as the calling user when the Admin
 * SDK isn't configured (only works because firestore.rules allows any signed-in user to read/write
 * `customTestPapers` - see firestore.rules).
 */

export async function saveCustomTestPaperRecord(record: CustomTestPaperRecord, idToken?: string): Promise<void> {
  if (isFirebaseAdminConfigured) {
    await getAdminDb().collection(COLLECTION).doc(record.id).set(record);
    return;
  }

  await restSetDocument(requireIdTokenForRestFallback(idToken), COLLECTION, record.id, record as unknown as Record<string, unknown>);
}

export async function getCustomTestPaperRecord(id: string, idToken?: string): Promise<CustomTestPaperRecord | null> {
  if (isFirebaseAdminConfigured) {
    const snapshot = await getAdminDb().collection(COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as CustomTestPaperRecord;
  }

  const data = await restGetDocument(requireIdTokenForRestFallback(idToken), COLLECTION, id);
  return data as CustomTestPaperRecord | null;
}

/** Lists every custom test paper regardless of track - callers filter by testType/roleId themselves. Collection is
 *  expected to stay small (single-admin authored content), so no server-side filtering is needed. */
export async function listCustomTestPaperRecords(idToken?: string): Promise<CustomTestPaperRecord[]> {
  if (isFirebaseAdminConfigured) {
    const snapshot = await getAdminDb().collection(COLLECTION).orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => doc.data() as CustomTestPaperRecord);
  }

  const rows = await restListDocuments(requireIdTokenForRestFallback(idToken), COLLECTION, {
    direction: "DESCENDING",
    orderByField: "createdAt"
  });
  return rows as CustomTestPaperRecord[];
}

/** Best-effort variant used by the public (non-admin) template routes: swallows the "Admin SDK not configured and
 *  no idToken" case as "no custom papers yet" instead of failing the whole request, so the compiled/hardcoded
 *  banks still work even in a local dev environment that hasn't set up either auth path. */
export async function listCustomTestPaperRecordsSafe(idToken?: string): Promise<CustomTestPaperRecord[]> {
  try {
    return await listCustomTestPaperRecords(idToken);
  } catch {
    return [];
  }
}

export async function getCustomTestPaperRecordSafe(id: string, idToken?: string): Promise<CustomTestPaperRecord | null> {
  try {
    return await getCustomTestPaperRecord(id, idToken);
  } catch {
    return null;
  }
}
