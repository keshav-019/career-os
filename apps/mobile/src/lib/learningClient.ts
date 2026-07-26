import { LEGACY_WEB_BASE_URL, R2_PUBLIC_BASE_URL } from "../config/env";
import { apiGet, apiPost } from "./apiClient";
import { fetchMcqReview } from "./practiceAttempts";
import type { PracticeAttemptRecord } from "../types/practiceAttempt";
import type {
  AiLearningPlan,
  LearningTrackId,
  TopicDetail,
  TrackSummary,
  WeakTopicRow
} from "../types/learning";

/** Thin wrapper around the legacy web app's learning content routes - see
 *  apps/web/src/app/api/learning/library/route.ts and .../topic/route.ts. Both return the raw payload
 *  (no {ok,...} wrapper), matching web's own fetch usage exactly. These two routes are the only calls in this app
 *  that still target LEGACY_WEB_BASE_URL instead of the default API_BASE_URL (apps/mobile-backend) - see
 *  config/env.ts for why. Their figure images are fetched separately, via resolveAssetUrl below, from
 *  R2_PUBLIC_BASE_URL - not from LEGACY_WEB_BASE_URL. */

export async function fetchLearningLibrary(): Promise<{ generatedAt: string; tracks: TrackSummary[] }> {
  return apiGet("/api/learning/library", LEGACY_WEB_BASE_URL);
}

export async function fetchTopicDetail(track: LearningTrackId, subjectId: string, topicId: string): Promise<TopicDetail> {
  const params = new URLSearchParams({ track, subjectId, topicId });
  return apiGet(`/api/learning/topic?${params.toString()}`, LEGACY_WEB_BASE_URL);
}

/** Figure/track image `src` values are site-relative (e.g. "/learning/os/fig-2-1.png") - these now live in
 *  Cloudflare R2's public bucket (R2_PUBLIC_BASE_URL), not on the web app's own origin, so every relative asset
 *  path needs that base URL prefixed to become a loadable absolute URL. See config/env.ts. */
export function resolveAssetUrl(src: string | undefined): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return `${R2_PUBLIC_BASE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
}

type LearningPlanTrackInput = {
  id: string;
  title: string;
  subjects: { id: string; order: number; overview: string; title: string; topicCount: number }[];
};

export async function generateLearningPlan(
  tracks: LearningPlanTrackInput[],
  weakRows: { earned: number; percentage: number; subtopic: string; topic: string; total: number }[]
): Promise<AiLearningPlan> {
  const result = await apiPost<{ ok: boolean; plan?: AiLearningPlan; error?: string }>("/api/ai/learning-plan", { tracks, weakRows });
  if (!result.plan) throw new Error(result.error || "Unable to generate a learning plan.");
  return result.plan;
}

function percentageFromMarks(earned: number, total: number): number {
  return total > 0 ? Math.round((earned / total) * 100) : 0;
}

function formatTestType(testType: string): string {
  if (testType === "computer-science") return "Computer Science";
  if (testType === "ai") return "AI";
  return testType.charAt(0).toUpperCase() + testType.slice(1);
}

/** Mirrors apps/web/src/app/learning/page.tsx's computeWeakTopicRows(), but since mobile has no bundled answer
 *  key, MCQ correctness is resolved once up front via /api/interview/mcq-review (same endpoint the War Room's
 *  TestRoomScreen uses) instead of a client-side getMcqQuestionById() lookup. */
export async function computeWeakTopicRows(attempts: PracticeAttemptRecord[]): Promise<WeakTopicRow[]> {
  const completed = attempts.filter((a) => a.status === "submitted" || a.status === "timed_out");
  const allMcqIds = new Set<string>();
  completed.forEach((attempt) => attempt.questions.forEach((q) => q.kind === "mcq" && allMcqIds.add(q.id)));

  let correctById = new Map<string, string>();
  if (allMcqIds.size > 0) {
    const { reviews } = await fetchMcqReview([...allMcqIds], {});
    correctById = new Map(Object.entries(reviews).map(([id, review]) => [id, review.correctOptionId]));
  }

  const tracker = new Map<string, WeakTopicRow>();
  completed.forEach((attempt) => {
    const topic = formatTestType(attempt.testType);
    attempt.questions.forEach((question) => {
      const subtopic = question.category || "General";
      const key = `${topic}::${subtopic}`;
      let earned = 0;
      if (question.kind === "mcq") {
        const selected = (attempt.mcqAnswers[question.id] ?? "").trim().toLowerCase();
        const correct = correctById.get(question.id);
        earned = correct && selected && selected === correct ? 1 : 0;
      } else {
        earned = attempt.codingCompletion[question.id] === true ? 1 : 0;
      }
      const current = tracker.get(key) ?? { key, topic, subtopic, earned: 0, total: 0, percentage: 0 };
      current.earned += earned;
      current.total += 1;
      tracker.set(key, current);
    });
  });

  return [...tracker.values()]
    .map((row) => ({ ...row, percentage: percentageFromMarks(row.earned, row.total) }))
    .sort((a, b) => (a.percentage !== b.percentage ? a.percentage - b.percentage : b.total - a.total || a.subtopic.localeCompare(b.subtopic)));
}
