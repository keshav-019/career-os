import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { restGetDocument, restListDocuments, restSetDocument } from "@/lib/firebase/firestore-rest";
import { getR2SignedUrl } from "@/lib/r2/client";
import type { MaterialFigure, TopicSummary, SubjectSummary, TrackSummary, TopicDetail } from "./public-types";

const COLLECTION = "learningCategories";

export type AdminLearningFigure = {
  id: string;
  r2Key: string;
  caption?: string;
  description?: string;
};

export type AdminLearningTopic = {
  id: string;
  title: string;
  order: number;
  active: boolean;
  difficulty: string;
  focusKeywords: string[];
  readingParagraphs: string[];
  figures: AdminLearningFigure[];
};

export type AdminLearningSubtopic = {
  id: string;
  title: string;
  order: number;
  active: boolean;
  overview: string;
  capstoneTasks: string[];
  topics: AdminLearningTopic[];
};

export type AdminLearningCategory = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  order: number;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  subtopics: AdminLearningSubtopic[];
};

function requireIdTokenForRestFallback(idToken: string | undefined): string {
  if (!idToken) {
    throw new Error("Missing Firebase Admin environment variables.");
  }
  return idToken;
}

/** Mirrors lib/coding-catalog/firestore.ts's Admin-SDK-preferred / REST-fallback pattern exactly. Each category
 *  document embeds its own subtopics and topics as nested arrays (rather than Firestore subcollections) - this is
 *  an admin-curated, small-scale content set, so one document per category comfortably stays under Firestore's
 *  1MB document limit while avoiding N+1 subcollection reads to render the whole category. Topic reading text
 *  lives directly in the document (plain strings, no reason to push tiny amounts of text to R2); only images go
 *  to R2 (see uploadLearningImage below), referenced here by R2 key alone. */

export async function saveLearningCategory(record: AdminLearningCategory, idToken?: string): Promise<void> {
  if (isFirebaseAdminConfigured) {
    await getAdminDb().collection(COLLECTION).doc(record.id).set(record);
    return;
  }
  await restSetDocument(requireIdTokenForRestFallback(idToken), COLLECTION, record.id, record as unknown as Record<string, unknown>);
}

export async function getLearningCategory(id: string, idToken?: string): Promise<AdminLearningCategory | null> {
  if (isFirebaseAdminConfigured) {
    const snapshot = await getAdminDb().collection(COLLECTION).doc(id).get();
    return snapshot.exists ? (snapshot.data() as AdminLearningCategory) : null;
  }
  const data = await restGetDocument(requireIdTokenForRestFallback(idToken), COLLECTION, id);
  return data as AdminLearningCategory | null;
}

export async function listLearningCategories(idToken?: string): Promise<AdminLearningCategory[]> {
  if (isFirebaseAdminConfigured) {
    const snapshot = await getAdminDb().collection(COLLECTION).orderBy("order", "asc").get();
    return snapshot.docs.map((doc) => doc.data() as AdminLearningCategory);
  }
  const rows = await restListDocuments(requireIdTokenForRestFallback(idToken), COLLECTION, { direction: "ASCENDING", orderByField: "order" });
  return rows as AdminLearningCategory[];
}

/** Best-effort variant for the public (non-admin) learning routes: swallows "no Admin SDK and no idToken" as "no
 *  admin categories yet" instead of failing the whole request, same reasoning as
 *  lib/interview/custom-test-papers.ts's *Safe variants. */
export async function listLearningCategoriesSafe(idToken?: string): Promise<AdminLearningCategory[]> {
  try {
    return await listLearningCategories(idToken);
  } catch {
    return [];
  }
}

export async function getLearningCategorySafe(id: string, idToken?: string): Promise<AdminLearningCategory | null> {
  try {
    return await getLearningCategory(id, idToken);
  } catch {
    return null;
  }
}

async function resolveFigure(figure: AdminLearningFigure): Promise<MaterialFigure> {
  let src = "";
  try {
    src = await getR2SignedUrl(figure.r2Key);
  } catch {
    src = "";
  }
  return { id: figure.id, src, caption: figure.caption, description: figure.description };
}

function toTopicSummary(topic: AdminLearningTopic): TopicSummary {
  return { id: topic.id, title: topic.title, difficulty: topic.difficulty, focusKeywords: topic.focusKeywords };
}

function toSubjectSummary(subtopic: AdminLearningSubtopic): SubjectSummary {
  const activeTopics = subtopic.topics.filter((t) => t.active).sort((a, b) => a.order - b.order);
  return {
    id: subtopic.id,
    title: subtopic.title,
    order: subtopic.order,
    overview: subtopic.overview,
    topicCount: activeTopics.length,
    capstoneTasks: subtopic.capstoneTasks,
    defaultReferenceIds: [],
    selfAssessmentChecklist: [],
    topics: activeTopics.map(toTopicSummary)
  };
}

/** Converts an admin-authored category into the exact same TrackSummary shape the two built-in tracks
 *  (computer-science, ai) already return from getLearningLibrarySummary() - see lib/learning/material-library.ts.
 *  Both web and mobile already render whatever tracks come back from /api/learning/library with zero awareness
 *  of where they came from, so this is all that's needed for admin-added categories to show up identically. */
export function categoryToTrackSummary(category: AdminLearningCategory): TrackSummary {
  const activeSubtopics = category.subtopics.filter((s) => s.active).sort((a, b) => a.order - b.order);
  const subjects = activeSubtopics.map(toSubjectSummary);
  const topicCount = subjects.reduce((sum, s) => sum + s.topicCount, 0);

  return {
    id: category.id,
    title: category.title,
    subtitle: category.subtitle,
    description: category.description,
    available: true,
    topicCount,
    subjects
  };
}

export async function findAdminTopicDetail(
  categoryId: string,
  subtopicId: string,
  topicId: string
): Promise<TopicDetail | null> {
  const category = await getLearningCategorySafe(categoryId);
  if (!category || !category.active) return null;

  const subtopic = category.subtopics.find((s) => s.id === subtopicId && s.active);
  if (!subtopic) return null;

  const topic = subtopic.topics.find((t) => t.id === topicId && t.active);
  if (!topic) return null;

  const figures = await Promise.all(topic.figures.map(resolveFigure));

  return {
    subjectId: subtopic.id,
    subjectTitle: subtopic.title,
    topicId: topic.id,
    title: topic.title,
    difficulty: topic.difficulty,
    focusKeywords: topic.focusKeywords,
    paragraphPages: topic.readingParagraphs.map(() => 1),
    readingParagraphs: topic.readingParagraphs,
    figures,
    referenceGroups: []
  };
}

/** Every admin category is checked when resolving a topic since categoryId isn't known ahead of time by the
 *  caller (the public /api/learning/topic route only receives track/subjectId/topicId) - fine at this project's
 *  scale (a handful of admin-curated categories, not thousands). */
export async function findAdminTopicDetailByIds(trackId: string, subjectId: string, topicId: string): Promise<TopicDetail | null> {
  const categories = await listLearningCategoriesSafe();
  const category = categories.find((c) => c.id === trackId && c.active);
  if (!category) return null;
  return findAdminTopicDetail(category.id, subjectId, topicId);
}
