/**
 * Pure logic + authed-fetch helpers for the test-papers admin page (aptitude / computer-science / AI technical).
 * Mirrors apps/web/src/app/admin/coding-problems/shared.ts exactly, adapted for the test-paper shape instead of a
 * coding problem.
 */

import { auth } from "@/lib/firebase/client";
import type { InterviewQuestionDifficulty } from "@/lib/interview/question-bank";
import type { CustomTestPaperInput, CustomTestPaperRecord } from "@/lib/interview/custom-test-papers";

export type TestPaperTrack = "aptitude" | "computer-science" | "ai";

export const TRACK_LABELS: Record<TestPaperTrack, string> = {
  aptitude: "Aptitude",
  "computer-science": "Computer Science",
  ai: "AI Technical"
};

export const DIFFICULTIES: (InterviewQuestionDifficulty | "")[] = ["", "easy", "medium", "hard"];

export type QuestionRow = {
  category: string;
  correctOptionIndex: number;
  difficulty: InterviewQuestionDifficulty | "";
  explanation: string;
  options: [string, string, string, string];
  prompt: string;
};

export type FormState = {
  categoryFocusText: string;
  durationMinutesText: string;
  id: string;
  questions: QuestionRow[];
  roleId: string;
  subtitle: string;
  summary: string;
  testType: TestPaperTrack;
  title: string;
};

export function emptyQuestionRow(): QuestionRow {
  return {
    category: "",
    prompt: "",
    options: ["", "", "", ""],
    correctOptionIndex: 0,
    explanation: "",
    difficulty: ""
  };
}

export function emptyForm(testType: TestPaperTrack = "aptitude"): FormState {
  return {
    id: "",
    testType,
    roleId: "",
    title: "",
    subtitle: "",
    summary: "",
    durationMinutesText: "",
    categoryFocusText: "",
    questions: [emptyQuestionRow()]
  };
}

export function recordToForm(record: CustomTestPaperRecord): FormState {
  return {
    id: record.id,
    testType: record.testType,
    roleId: record.roleId ?? "",
    title: record.title,
    subtitle: record.subtitle,
    summary: record.summary,
    durationMinutesText: String(record.durationMinutes),
    categoryFocusText: record.categoryFocus.join(", "),
    questions: record.questions.map((question) => ({
      category: question.category,
      prompt: question.prompt,
      options: [
        question.options[0]?.text ?? "",
        question.options[1]?.text ?? "",
        question.options[2]?.text ?? "",
        question.options[3]?.text ?? ""
      ],
      correctOptionIndex: question.options.findIndex((option) => option.id === question.correctOptionId),
      explanation: question.explanation,
      difficulty: question.difficulty ?? ""
    }))
  };
}

export function splitCommaList(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildPayloadFromForm(form: FormState): CustomTestPaperInput {
  if (!form.title.trim()) {
    throw new Error("Title is required.");
  }

  if (form.testType === "ai" && !form.roleId.trim()) {
    throw new Error("Pick an AI role for this test paper.");
  }

  const questions = form.questions.filter((row) => row.prompt.trim() || row.options.some((option) => option.trim()));
  if (questions.length === 0) {
    throw new Error("Add at least one question.");
  }

  const trimmedDuration = form.durationMinutesText.trim();
  let durationMinutes: number | undefined;
  if (trimmedDuration) {
    durationMinutes = Number(trimmedDuration);
    if (!Number.isFinite(durationMinutes)) {
      throw new Error("Duration must be a number (minutes).");
    }
  }

  return {
    id: form.id.trim() || undefined,
    testType: form.testType,
    roleId: form.testType === "ai" ? form.roleId.trim() : undefined,
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || undefined,
    summary: form.summary.trim() || undefined,
    durationMinutes,
    categoryFocus: form.categoryFocusText.trim() ? splitCommaList(form.categoryFocusText) : undefined,
    questions: questions.map((row) => ({
      category: row.category.trim() || undefined,
      prompt: row.prompt.trim(),
      options: row.options.map((option) => option.trim()),
      correctOptionIndex: row.correctOptionIndex,
      explanation: row.explanation.trim() || undefined,
      difficulty: row.difficulty || undefined
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
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${idToken}`
    }
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

export async function fetchAllTestPapers(): Promise<CustomTestPaperRecord[]> {
  const payload = await authedRequest<{ papers: CustomTestPaperRecord[] }>("/api/admin/test-papers", { method: "GET" });
  return payload.papers;
}

export async function saveOneTestPaper(payload: CustomTestPaperInput): Promise<CustomTestPaperRecord> {
  const result = await authedRequest<{ paper: CustomTestPaperRecord }>("/api/admin/test-papers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return result.paper;
}
