import { NextRequest, NextResponse } from "next/server";
import {
  listInterviewTestTemplates,
  type InterviewTestTemplate,
  type InterviewTestType
} from "@/lib/interview/question-bank";
import { listCustomTestPaperRecordsSafe } from "@/lib/interview/custom-test-papers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_TYPES: InterviewTestType[] = ["coding", "aptitude", "computer-science", "ai"];

function isTestType(value: string): value is InterviewTestType {
  return TEST_TYPES.includes(value as InterviewTestType);
}

/** Thin wrapper around the existing (client-safe) question-bank.ts pure functions, exposed over HTTP so the
 *  mobile app can list a track's compiled test templates without bundling the ~6.8MB compiled question JSON -
 *  see apps/mobile/src/lib/practiceAttempts.ts for the consumer. Web itself still calls listInterviewTestTemplates
 *  directly client-side (no change there); this route exists purely for mobile.
 *
 *  Also merges in any admin-authored test papers from Firestore (see /admin/test-papers and
 *  lib/interview/custom-test-papers.ts) for aptitude/computer-science/ai, listed first so newly added content is
 *  easy to find. Coding has no custom papers - it stays desktop-gated on mobile. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get("testType") ?? "";
    const roleId = searchParams.get("roleId") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    if (!isTestType(testType)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid testType. Expected coding, aptitude, computer-science, or ai." },
        { status: 400 }
      );
    }

    const compiledTemplates = listInterviewTestTemplates(testType, limit, roleId);

    let customTemplates: InterviewTestTemplate[] = [];
    if (testType !== "coding") {
      const customPapers = await listCustomTestPaperRecordsSafe();
      customTemplates = customPapers
        .filter((paper) => paper.testType === testType && (testType !== "ai" || paper.roleId === roleId))
        .map((paper, index) => ({
          id: paper.id,
          index: -(index + 1),
          testType: paper.testType,
          mode: "mcq" as const,
          title: paper.title,
          subtitle: paper.subtitle,
          summary: paper.summary,
          durationMinutes: paper.durationMinutes,
          questionCount: paper.questions.length,
          categoryFocus: paper.categoryFocus,
          roleId: paper.roleId,
          roleName: paper.roleName
        }));
    }

    const templates = [...customTemplates, ...compiledTemplates];
    return NextResponse.json({ ok: true, templates: limit ? templates.slice(0, limit) : templates });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to list interview templates." },
      { status: 500 }
    );
  }
}
