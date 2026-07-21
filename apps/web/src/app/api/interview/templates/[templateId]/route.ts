import { NextRequest, NextResponse } from "next/server";
import {
  buildPracticeAttemptSeed,
  getInterviewTestTemplate,
  type InterviewTestTemplate,
  type InterviewTestType,
  type PracticeQuestion
} from "@/lib/interview/question-bank";
import { getCustomTestPaperRecordSafe } from "@/lib/interview/custom-test-papers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_TYPES: InterviewTestType[] = ["coding", "aptitude", "computer-science", "ai"];

function isTestType(value: string): value is InterviewTestType {
  return TEST_TYPES.includes(value as InterviewTestType);
}

/** Returns a single template plus its fully-built (seeded, deterministic) question set - the mobile equivalent of
 *  what web's own createPracticeAttempt() does in-process via buildPracticeAttemptSeed(). See
 *  apps/mobile/src/lib/practiceAttempts.ts's fetchTemplateQuestions() for the consumer. Note: for the "ai" track,
 *  the role is encoded directly in templateId (format ai_{roleId}_test_{index}), so no separate roleId param is
 *  needed to resolve the template or its questions.
 *
 *  Checks Firestore-backed custom test papers (see /admin/test-papers) before falling back to the compiled bank,
 *  since a custom paper's id doesn't match the compiled id pattern anyway. The answer key is stripped here exactly
 *  like the compiled path - correctOptionId/explanation only ever come back through /api/interview/mcq-review. */
export async function GET(request: NextRequest, context: { params: Promise<{ templateId: string }> }) {
  try {
    const { templateId } = await context.params;
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get("testType") ?? "";

    if (!isTestType(testType)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid testType. Expected coding, aptitude, computer-science, or ai." },
        { status: 400 }
      );
    }

    if (!templateId) {
      return NextResponse.json({ ok: false, error: "A templateId is required." }, { status: 400 });
    }

    if (testType !== "coding") {
      const customPaper = await getCustomTestPaperRecordSafe(templateId);
      if (customPaper && customPaper.testType === testType) {
        const template: InterviewTestTemplate = {
          id: customPaper.id,
          index: 0,
          testType: customPaper.testType,
          mode: "mcq",
          title: customPaper.title,
          subtitle: customPaper.subtitle,
          summary: customPaper.summary,
          durationMinutes: customPaper.durationMinutes,
          questionCount: customPaper.questions.length,
          categoryFocus: customPaper.categoryFocus,
          roleId: customPaper.roleId,
          roleName: customPaper.roleName
        };

        const questions: PracticeQuestion[] = customPaper.questions.map((question) => ({
          id: question.id,
          kind: "mcq",
          category: question.category,
          prompt: question.prompt,
          difficulty: question.difficulty,
          options: question.options
        }));

        return NextResponse.json({ ok: true, template, questions });
      }
    }

    const template = getInterviewTestTemplate(testType, templateId);
    if (!template) {
      return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
    }

    const seed = buildPracticeAttemptSeed(testType, templateId);
    return NextResponse.json({ ok: true, template, questions: seed.questions });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load this template." },
      { status: 500 }
    );
  }
}
