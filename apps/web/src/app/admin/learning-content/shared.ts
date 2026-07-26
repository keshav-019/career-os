/** Pure logic + authed-fetch helpers for the Learning Content admin page. Mirrors
 *  apps/web/src/app/admin/coding-problems/shared.ts's authedRequest() exactly. */

import { auth } from "@/lib/firebase/client";
import type { AdminLearningCategory } from "@/lib/learning/admin-content";

export type FigureForm = { id: string; r2Key: string; previewUrl: string; caption: string; description: string };
export type TopicForm = {
  id: string;
  title: string;
  active: boolean;
  difficulty: string;
  focusKeywordsText: string;
  readingParagraphsText: string;
  figures: FigureForm[];
};
export type SubtopicForm = {
  id: string;
  title: string;
  active: boolean;
  overview: string;
  capstoneTasksText: string;
  topics: TopicForm[];
};
export type CategoryForm = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  active: boolean;
  subtopics: SubtopicForm[];
};

export function emptyTopic(): TopicForm {
  return { id: "", title: "", active: true, difficulty: "beginner", focusKeywordsText: "", readingParagraphsText: "", figures: [] };
}

export function emptySubtopic(): SubtopicForm {
  return { id: "", title: "", active: true, overview: "", capstoneTasksText: "", topics: [emptyTopic()] };
}

export function emptyCategoryForm(): CategoryForm {
  return { id: "", title: "", subtitle: "", description: "", active: true, subtopics: [emptySubtopic()] };
}

function splitLines(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitCommaList(text: string): string[] {
  return text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function categoryToForm(category: AdminLearningCategory): CategoryForm {
  return {
    id: category.id,
    title: category.title,
    subtitle: category.subtitle,
    description: category.description,
    active: category.active,
    subtopics: category.subtopics.map((subtopic) => ({
      id: subtopic.id,
      title: subtopic.title,
      active: subtopic.active,
      overview: subtopic.overview,
      capstoneTasksText: subtopic.capstoneTasks.join("\n"),
      topics: subtopic.topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        active: topic.active,
        difficulty: topic.difficulty,
        focusKeywordsText: topic.focusKeywords.join(", "),
        readingParagraphsText: topic.readingParagraphs.join("\n\n"),
        figures: topic.figures.map((figure) => ({
          id: figure.id,
          r2Key: figure.r2Key,
          previewUrl: "",
          caption: figure.caption ?? "",
          description: figure.description ?? ""
        }))
      }))
    }))
  };
}

export function buildPayloadFromForm(form: CategoryForm) {
  if (!form.title.trim()) {
    throw new Error("Category title is required.");
  }

  return {
    id: form.id.trim() || undefined,
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    description: form.description.trim(),
    active: form.active,
    subtopics: form.subtopics
      .filter((s) => s.title.trim())
      .map((subtopic) => ({
        id: subtopic.id.trim() || undefined,
        title: subtopic.title.trim(),
        active: subtopic.active,
        overview: subtopic.overview.trim(),
        capstoneTasks: splitLines(subtopic.capstoneTasksText),
        topics: subtopic.topics
          .filter((t) => t.title.trim())
          .map((topic) => ({
            id: topic.id.trim() || undefined,
            title: topic.title.trim(),
            active: topic.active,
            difficulty: topic.difficulty.trim() || "beginner",
            focusKeywords: splitCommaList(topic.focusKeywordsText),
            readingParagraphs: splitLines(topic.readingParagraphsText),
            figures: topic.figures
              .filter((f) => f.r2Key)
              .map((figure) => ({ id: figure.id || undefined, r2Key: figure.r2Key, caption: figure.caption, description: figure.description }))
          }))
      }))
  };
}

export async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!auth?.currentUser) {
    throw new Error("Sign in before using the admin tool.");
  }
  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${idToken}` }
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

export async function fetchAllCategories(): Promise<AdminLearningCategory[]> {
  const payload = await authedRequest<{ categories: AdminLearningCategory[] }>("/api/admin/learning-content", { method: "GET" });
  return payload.categories;
}

export async function saveCategory(payload: ReturnType<typeof buildPayloadFromForm>): Promise<AdminLearningCategory> {
  const result = await authedRequest<{ category: AdminLearningCategory }>("/api/admin/learning-content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return result.category;
}

export async function uploadFigureImage(categoryId: string, file: File): Promise<{ key: string; previewUrl: string }> {
  if (!auth?.currentUser) {
    throw new Error("Sign in before using the admin tool.");
  }
  const idToken = await auth.currentUser.getIdToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("categoryId", categoryId);
  const response = await fetch("/api/admin/learning-content/upload-image", {
    method: "POST",
    headers: { authorization: `Bearer ${idToken}` },
    body: formData
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; key?: string; previewUrl?: string };
  if (!response.ok || !payload.ok || !payload.key) {
    throw new Error(payload.error || `Upload failed (${response.status}).`);
  }
  return { key: payload.key, previewUrl: payload.previewUrl ?? "" };
}
