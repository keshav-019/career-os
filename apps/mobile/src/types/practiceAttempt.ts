// Mirrors PracticeAttemptRecord + question shapes from apps/web/src/lib/firebase/interview-war-room.ts and
// apps/web/src/lib/interview/question-bank.ts.
export type InterviewTestType = "coding" | "aptitude" | "computer-science" | "ai";
export type AttemptMode = "mcq" | "coding";
export type AttemptStatus = "ready" | "in_progress" | "submitted" | "timed_out";
export type McqOptionId = "a" | "b" | "c" | "d";

// Note: correctOptionId/explanation are answer-key fields that the web app only ever resolves client-side from
// its own bundled ~6.8MB question bank (getMcqQuestionById) - mobile has no such bundle, so the
// /api/interview/templates/[templateId] route sends this answer-stripped shape (matching web's own
// PracticeMcqQuestion type). Scoring and post-submit review both go through /api/interview/mcq-review instead -
// see fetchMcqReview() in src/lib/practiceAttempts.ts.
export type McqQuestion = {
  id: string;
  kind: "mcq";
  category: string;
  prompt: string;
  imageUrl?: string;
  imageAlt?: string;
  imageSourceUrl?: string;
  difficulty?: string;
  options: { id: McqOptionId; text: string }[];
};

export type McqReviewEntry = { correctOptionId: McqOptionId; explanation: string };

export type CodingQuestion = {
  id: string;
  kind: "coding";
  category: string;
  prompt: string;
  difficulty: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  sampleInput: string;
  sampleOutput: string;
  hints: string[];
};

export type PracticeQuestion = McqQuestion | CodingQuestion;

export type InterviewTestTemplate = {
  id: string;
  index: number;
  testType: InterviewTestType;
  title: string;
  subtitle: string;
  summary: string;
  durationMinutes: number;
  questionCount: number;
  mode: AttemptMode;
  categoryFocus: string[];
  roleId?: string;
  roleName?: string;
};

export type AiInterviewRole = {
  id: string;
  name: string;
  imageSrc?: string;
  imageAlt?: string;
  summary: string;
  focusTopics: string[];
  questionCount: number;
};

export type PracticeAttemptRecord = {
  id: string;
  userId: string;
  testType: InterviewTestType;
  mode: AttemptMode;
  title: string;
  subtitle: string;
  testTemplateId?: string;
  description: string;
  durationMinutes: number;
  questionCount: number;
  questionIds: string[];
  categories: string[];
  questions: PracticeQuestion[];
  status: AttemptStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  deadlineAt?: string;
  submittedAt?: string;
  currentQuestionIndex: number;
  mcqAnswers: Record<string, string>;
  codingNotes: Record<string, string>;
  codingCompletion: Record<string, boolean>;
  answerKeyVersion: string;
  score?: { total: number; correct: number; answered: number; percentage: number };
};

export function formatInterviewTestType(testType: InterviewTestType): string {
  switch (testType) {
    case "coding":
      return "Coding";
    case "aptitude":
      return "Aptitude";
    case "computer-science":
      return "Computer Science";
    case "ai":
      return "AI";
    default:
      return testType;
  }
}

export function hasDesktopOnlyExecution(mode: AttemptMode): boolean {
  return mode === "coding";
}
