import {
  getLearningCategory,
  listLearningCategories,
  saveLearningCategory,
  type AdminLearningCategory
} from "@/lib/learning/admin-content";
import { requireAdmin } from "@/lib/server/require-admin";

export const runtime = "nodejs";

/** Admin-only CRUD for Learning Center categories added via /admin/learning-content - mirrors
 *  api/admin/coding-problems/route.ts exactly. Public read access (merged into the existing learning tracks) is
 *  handled separately by /api/learning/library and /api/learning/topic. */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type CategoryInput = {
  id?: string;
  title: string;
  subtitle?: string;
  description?: string;
  order?: number;
  active?: boolean;
  subtopics?: {
    id?: string;
    title: string;
    order?: number;
    active?: boolean;
    overview?: string;
    capstoneTasks?: string[];
    topics?: {
      id?: string;
      title: string;
      order?: number;
      active?: boolean;
      difficulty?: string;
      focusKeywords?: string[];
      readingParagraphs?: string[];
      figures?: { id?: string; r2Key: string; caption?: string; description?: string }[];
    }[];
  }[];
};

function buildCategoryRecord(
  input: CategoryInput,
  context: { createdBy: string; existingCreatedAt?: string }
): AdminLearningCategory {
  const title = input.title?.trim();
  if (!title) {
    throw new Error("Title is required.");
  }

  const id = slugify(input.id?.trim() || title);
  if (!id) {
    throw new Error("Unable to derive an id from the title - set one explicitly.");
  }

  const now = new Date().toISOString();

  const subtopics = (input.subtopics ?? []).map((subtopic, subtopicIndex) => {
    const subtopicTitle = subtopic.title?.trim();
    if (!subtopicTitle) {
      throw new Error(`Subtopic ${subtopicIndex + 1}: title is required.`);
    }
    const subtopicId = slugify(subtopic.id?.trim() || subtopicTitle);

    const topics = (subtopic.topics ?? []).map((topic, topicIndex) => {
      const topicTitle = topic.title?.trim();
      if (!topicTitle) {
        throw new Error(`Subtopic "${subtopicTitle}", topic ${topicIndex + 1}: title is required.`);
      }
      const topicId = slugify(topic.id?.trim() || topicTitle);
      const readingParagraphs = (topic.readingParagraphs ?? []).map((p) => p.trim()).filter(Boolean);
      if (readingParagraphs.length === 0) {
        throw new Error(`Topic "${topicTitle}": add at least one reading paragraph/description.`);
      }

      return {
        id: topicId,
        title: topicTitle,
        order: topic.order ?? topicIndex,
        active: topic.active !== false,
        difficulty: topic.difficulty?.trim() || "beginner",
        focusKeywords: topic.focusKeywords ?? [],
        readingParagraphs,
        figures: (topic.figures ?? []).map((figure, figureIndex) => ({
          id: figure.id?.trim() || `${topicId}-fig-${figureIndex + 1}`,
          r2Key: figure.r2Key,
          caption: figure.caption,
          description: figure.description
        }))
      };
    });

    return {
      id: subtopicId,
      title: subtopicTitle,
      order: subtopic.order ?? subtopicIndex,
      active: subtopic.active !== false,
      overview: subtopic.overview?.trim() || "",
      capstoneTasks: subtopic.capstoneTasks ?? [],
      topics
    };
  });

  return {
    id,
    title,
    subtitle: input.subtitle?.trim() || "",
    description: input.description?.trim() || "",
    order: input.order ?? 0,
    active: input.active !== false,
    createdBy: context.createdBy,
    createdAt: context.existingCreatedAt ?? now,
    updatedAt: now,
    subtopics
  };
}

export async function GET(request: Request) {
  let verifiedAuth;
  try {
    verifiedAuth = await requireAdmin(request.headers.get("authorization"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Admin access required." }, { status: 403 });
  }

  try {
    const categories = await listLearningCategories(verifiedAuth.idToken);
    return Response.json({ ok: true, categories });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load categories." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let verifiedAuth;
  try {
    verifiedAuth = await requireAdmin(request.headers.get("authorization"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Admin access required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CategoryInput;
    const existing = body?.id ? await getLearningCategory(body.id, verifiedAuth.idToken) : null;

    const record = buildCategoryRecord(body, {
      createdBy: existing?.createdBy ?? verifiedAuth.userId,
      existingCreatedAt: existing?.createdAt
    });

    await saveLearningCategory(record, verifiedAuth.idToken);
    return Response.json({ ok: true, category: record });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save this category." }, { status: 400 });
  }
}
