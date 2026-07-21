// Mirrors apps/web/src/lib/learning/material-library.ts's public shapes, served by
// GET /api/learning/library and GET /api/learning/topic.
export type LearningTrackId = "computer-science" | "ai";

export type TopicSummary = { id: string; title: string; difficulty: string; focusKeywords: string[] };

export type SubjectSummary = {
  id: string;
  title: string;
  order: number;
  overview: string;
  topicCount: number;
  capstoneTasks: string[];
  defaultReferenceIds: string[];
  selfAssessmentChecklist: string[];
  topics: TopicSummary[];
};

export type TrackSummary = {
  id: LearningTrackId;
  title: string;
  subtitle: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  available: boolean;
  topicCount: number;
  subjects: SubjectSummary[];
};

export type MaterialFigure = {
  id: string;
  src: string;
  width?: number;
  height?: number;
  caption?: string;
  description?: string;
  page?: number;
  reference?: string;
};

export type MaterialReference = { id: string; title: string; url?: string };

export type TopicDetail = {
  subjectId: string;
  subjectTitle: string;
  topicId: string;
  title: string;
  difficulty: string;
  focusKeywords: string[];
  pageStart?: number;
  pageEnd?: number;
  paragraphPages: number[];
  readingParagraphs: string[];
  figures: MaterialFigure[];
  referenceGroups: { id: string; title: string; references: MaterialReference[] }[];
};

export type WeakTopicRow = { key: string; topic: string; subtopic: string; earned: number; total: number; percentage: number };

export type AiLearningPlanModule = {
  trackId: string;
  subjectId: string;
  trackTitle: string;
  subjectTitle: string;
  topicCount: number;
  priority: number;
  reason: string;
};

export type AiLearningPlan = {
  hasTestHistory: boolean;
  summary: string;
  modules: AiLearningPlanModule[];
};

export const FIGURE_MARKER_PATTERN = /\[\[figure:([a-zA-Z0-9_.:-]+)\]\]/g;
