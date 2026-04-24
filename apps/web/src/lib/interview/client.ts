/**
 * Client-side fetch helpers for the /api/interview/* routes - the web equivalent of
 * apps/mobile/src/lib/practiceAttempts.ts's fetchTemplateLibrary()/fetchAiRoles()/fetchMcqReview(). Question-bank
 * content (compiled question banks, AI role definitions, computer-science tests) now lives in R2 and is fetched
 * server-side only (see lib/interview/question-bank.ts's ensureQuestionBankLoaded()), so "use client" pages can no
 * longer import question-bank.ts's data-dependent functions directly - they go through these routes instead.
 * (formatInterviewTestType, listInterviewTracks, getInterviewTrack, hasDesktopOnlyExecution stay direct imports -
 * they're pure/static and don't touch the R2-backed data.)
 */
import { auth } from "@/lib/firebase/client";
import type { AiInterviewRole, InterviewTestTemplate, InterviewTestType, PracticeQuestion } from "@/lib/interview/question-bank";

export type McqReviewEntry = { correctOptionId: string; explanation: string };

export type McqReviewResult = {
  reviews: Record<string, McqReviewEntry>;
  score: { answered: number; correct: number; percentage: number; total: number };
};

async function authHeaders(): Promise<Record<string, string>> {
  const idToken = await auth?.currentUser?.getIdToken().catch(() => null);
  return idToken ? { authorization: `Bearer ${idToken}` } : {};
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: await authHeaders() });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

/** See apps/web/src/app/api/interview/ai-roles/route.ts. */
export async function fetchAiInterviewRoles(): Promise<AiInterviewRole[]> {
  const result = await apiGet<{ roles: AiInterviewRole[] }>("/api/interview/ai-roles");
  return result.roles;
}

/** See apps/web/src/app/api/interview/templates/route.ts. */
export async function fetchInterviewTestTemplates(
  testType: InterviewTestType,
  options?: { limit?: number; roleId?: string }
): Promise<InterviewTestTemplate[]> {
  const params = new URLSearchParams({ testType });
  if (options?.roleId) {
    params.set("roleId", options.roleId);
  }
  if (typeof options?.limit === "number") {
    params.set("limit", String(options.limit));
  }
  const result = await apiGet<{ templates: InterviewTestTemplate[] }>(`/api/interview/templates?${params.toString()}`);
  return result.templates;
}

/** See apps/web/src/app/api/interview/templates/[templateId]/route.ts. */
export async function fetchInterviewTestTemplateWithQuestions(
  testType: InterviewTestType,
  templateId: string
): Promise<{ questions: PracticeQuestion[]; template: InterviewTestTemplate }> {
  const params = new URLSearchParams({ testType });
  return apiGet(`/api/interview/templates/${encodeURIComponent(templateId)}?${params.toString()}`);
}

/** See apps/web/src/app/api/interview/mcq-review/route.ts. Passing an empty mcqAnswers object still returns the
 *  canonical `reviews` map (correctOptionId + explanation per question id) - useful when a caller only wants the
 *  answer key for already-known responses (e.g. analytics/learning pages recomputing topic breakdowns) rather
 *  than a fresh score. */
export async function fetchMcqReview(
  questionIds: string[],
  mcqAnswers: Record<string, string> = {}
): Promise<McqReviewResult> {
  return apiPost("/api/interview/mcq-review", { questionIds, mcqAnswers });
}
