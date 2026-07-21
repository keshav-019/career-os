import { Router } from "express";
import {
  buildPracticeAttemptSeed,
  getInterviewTestTemplate,
  getMcqQuestionById,
  listAiInterviewRoles,
  listInterviewTestTemplates,
  type InterviewTestTemplate,
  type InterviewTestType,
  type PracticeQuestion
} from "@/lib/interview/question-bank";
import {
  getCustomTestPaperRecordSafe,
  listCustomTestPaperRecordsSafe,
  parseCustomQuestionId
} from "@/lib/interview/custom-test-papers";

/**
 * Express port of apps/web/src/app/api/interview/{templates,templates/[templateId],ai-roles,mcq-review}/route.ts.
 * Logic is identical (imports the exact same lib/interview/*.ts files, no copy-pasted business logic) - only the
 * Next.js request/response plumbing (NextResponse.json, searchParams, context.params) is swapped for Express's
 * equivalents (res.json, req.query, req.params). See apps/mobile-backend/README.md for why this exists at all.
 */

const router = Router();

const TEST_TYPES: InterviewTestType[] = ["coding", "aptitude", "computer-science", "ai"];

function isTestType(value: string): value is InterviewTestType {
  return TEST_TYPES.includes(value as InterviewTestType);
}

router.get("/templates", async (req, res) => {
  try {
    const testType = String(req.query.testType ?? "");
    const roleId = req.query.roleId ? String(req.query.roleId) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;

    if (!isTestType(testType)) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing or invalid testType. Expected coding, aptitude, computer-science, or ai." });
    }

    const compiledTemplates = listInterviewTestTemplates(testType, limitParam, roleId);

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
    res.json({ ok: true, templates: limitParam ? templates.slice(0, limitParam) : templates });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to list interview templates." });
  }
});

router.get("/templates/:templateId", async (req, res) => {
  try {
    const { templateId } = req.params;
    const testType = String(req.query.testType ?? "");

    if (!isTestType(testType)) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing or invalid testType. Expected coding, aptitude, computer-science, or ai." });
    }

    if (!templateId) {
      return res.status(400).json({ ok: false, error: "A templateId is required." });
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

        return res.json({ ok: true, template, questions });
      }
    }

    const template = getInterviewTestTemplate(testType, templateId);
    if (!template) {
      return res.status(404).json({ ok: false, error: "Template not found." });
    }

    const seed = buildPracticeAttemptSeed(testType, templateId);
    res.json({ ok: true, template, questions: seed.questions });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to load this template." });
  }
});

router.get("/ai-roles", (_req, res) => {
  try {
    const roles = listAiInterviewRoles();
    res.json({ ok: true, roles });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to list AI roles." });
  }
});

router.post("/mcq-review", async (req, res) => {
  try {
    const body = req.body as { mcqAnswers?: Record<string, string>; questionIds?: string[] } | null;
    const questionIds = Array.isArray(body?.questionIds) ? body!.questionIds : [];
    const mcqAnswers = body?.mcqAnswers && typeof body.mcqAnswers === "object" ? body.mcqAnswers : {};

    let correct = 0;
    let answered = 0;
    const reviews: Record<string, { correctOptionId: string; explanation: string }> = {};
    const paperCache = new Map<string, Awaited<ReturnType<typeof getCustomTestPaperRecordSafe>>>();

    for (const questionId of questionIds) {
      let canonical: { correctOptionId: string; explanation: string } | null = null;

      const compiled = getMcqQuestionById(questionId);
      if (compiled) {
        canonical = { correctOptionId: compiled.correctOptionId, explanation: compiled.explanation };
      } else {
        const parsed = parseCustomQuestionId(questionId);
        if (parsed) {
          let paper = paperCache.get(parsed.paperId);
          if (paper === undefined) {
            paper = await getCustomTestPaperRecordSafe(parsed.paperId);
            paperCache.set(parsed.paperId, paper);
          }
          const question = paper?.questions.find((candidate) => candidate.id === questionId);
          canonical = question ? { correctOptionId: question.correctOptionId, explanation: question.explanation } : null;
        }
      }

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

    res.json({ ok: true, score: { total, correct, answered, percentage }, reviews });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to score this attempt." });
  }
});

export default router;
