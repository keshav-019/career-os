import { NextRequest, NextResponse } from "next/server";
import { getMcqQuestionById } from "@/lib/interview/question-bank";
import { getCustomTestPaperRecordSafe, parseCustomQuestionId } from "@/lib/interview/custom-test-papers";
import { requireAuthAndRateLimit } from "@/lib/server/require-auth-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewRequestBody = {
  mcqAnswers?: Record<string, string>;
  questionIds?: string[];
};

type CanonicalAnswer = { correctOptionId: string; explanation: string };

/** Scores MCQ answers and returns the canonical correct option + explanation per question, entirely server-side -
 *  neither platform receives the answer key up front (the /api/interview/templates/[templateId] response is the
 *  answer-stripped PracticeQuestion shape both use before a test is submitted). getMcqQuestionById() now lazily
 *  loads the question bank from R2 with real bucket credentials, server-side only, so this is the only place
 *  correctOptionId/explanation ever get resolved - see apps/mobile/src/lib/practiceAttempts.ts's
 *  submitPracticeAttempt() and apps/web/src/lib/interview/client.ts's fetchMcqReview() for the two consumers
 *  (web also uses this for post-submit review screens and analytics/topic-breakdown recomputation, not just
 *  scoring at submit time).
 *
 *  Question ids from a custom test paper (see /admin/test-papers) don't exist in the in-memory compiled lookup, so
 *  those fall back to fetching the source paper from Firestore - one fetch per distinct paper, cached for the
 *  duration of this request since a single test can have many questions from the same paper. */
async function resolveCanonicalAnswer(
  questionId: string,
  paperCache: Map<string, Awaited<ReturnType<typeof getCustomTestPaperRecordSafe>>>
): Promise<CanonicalAnswer | null> {
  const compiled = await getMcqQuestionById(questionId);
  if (compiled) {
    return { correctOptionId: compiled.correctOptionId, explanation: compiled.explanation };
  }

  const parsed = parseCustomQuestionId(questionId);
  if (!parsed) {
    return null;
  }

  let paper = paperCache.get(parsed.paperId);
  if (paper === undefined) {
    paper = await getCustomTestPaperRecordSafe(parsed.paperId);
    paperCache.set(parsed.paperId, paper);
  }

  const question = paper?.questions.find((candidate) => candidate.id === questionId);
  return question ? { correctOptionId: question.correctOptionId, explanation: question.explanation } : null;
}

export async function POST(request: NextRequest) {
  const gate = await requireAuthAndRateLimit(request, "interview-mcq-review", { maxRequests: 120 });
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json().catch(() => null)) as ReviewRequestBody | null;
    const questionIds = Array.isArray(body?.questionIds) ? body!.questionIds : [];
    const mcqAnswers = body?.mcqAnswers && typeof body.mcqAnswers === "object" ? body.mcqAnswers : {};

    let correct = 0;
    let answered = 0;
    const reviews: Record<string, CanonicalAnswer> = {};
    const paperCache = new Map<string, Awaited<ReturnType<typeof getCustomTestPaperRecordSafe>>>();

    for (const questionId of questionIds) {
      const canonical = await resolveCanonicalAnswer(questionId, paperCache);
      if (!canonical) continue;

      reviews[questionId] = canonical;

      const selected = (mcqAnswers[questionId] ?? "").trim().toLowerCase();
      if (selected) {
        answered += 1;
        if (selected === canonical.correctOptionId) correct += 1;
      }
    }

    const total = questionIds.filter((id) => reviews[id]).length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    return NextResponse.json({ ok: true, score: { total, correct, answered, percentage }, reviews });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to score this attempt." },
      { status: 500 }
    );
  }
}
