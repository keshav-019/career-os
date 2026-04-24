/** Wire shapes returned by /api/learning/library and /api/learning/topic - mirrors the private types inside
 *  material-library.ts structurally (same field names/shapes) so admin-added categories (lib/learning/admin-content.ts)
 *  can be merged into the same response with no changes needed on either client (apps/mobile/src/types/learning.ts
 *  already declares the exact same shapes independently). Kept as its own file rather than exporting
 *  material-library.ts's private types directly, to avoid touching that file's internals. */

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
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  available: boolean;
  topicCount: number;
  subjects: SubjectSummary[];
};

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
