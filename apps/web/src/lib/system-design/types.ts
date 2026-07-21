/**
 * Public (client-safe) shapes for the System Design track. Nothing in this file describes the
 * canonical tree structure or hints for a problem - those live server-side in `catalog.server.ts`
 * and are only ever revealed through the validate/solution API routes.
 */

export type SystemDesignDifficulty = "easy" | "medium" | "hard";

export type SystemDesignProblemSummary = {
  id: string;
  title: string;
  difficulty: SystemDesignDifficulty;
  companies: string[];
  tags: string[];
  summary: string;
};

export type PublicEstimationQuestion = {
  id: string;
  prompt: string;
  unit: string;
  placeholder?: string;
};

export type PublicTradeoffOption = {
  id: string;
  label: string;
};

export type PublicTradeoff = {
  /** The catalog node id this tradeoff fires after (the user just placed it correctly). */
  nodeId: string;
  prompt: string;
  options: PublicTradeoffOption[];
};

export type PublicFailureOption = {
  id: string;
  label: string;
};

export type PublicFailureQuestion = {
  id: string;
  prompt: string;
  options: PublicFailureOption[];
};

export type SystemDesignProblemDetail = SystemDesignProblemSummary & {
  statement: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  scaleNote?: string;
  rootComponentId: string;
  componentIds: string[];
  distractorIds: string[];
  totalNodeCount: number;
  estimationQuestions: PublicEstimationQuestion[];
  tradeoffs: PublicTradeoff[];
  failureQuestions: PublicFailureQuestion[];
};

export type ValidatePlacementRequest = {
  parentComponentId: string;
  attemptedComponentId: string;
  placedComponentIds: string[];
};

export type ValidatePlacementResponse = {
  correct: boolean;
  alreadyComplete?: boolean;
  message: string;
  whyItFits?: string;
  progress: {
    placedSoFar: number;
    total: number;
  };
};

export type SolutionNode = {
  componentId: string;
  parentComponentId: string | null;
  whyItFits: string;
};

export type SystemDesignSolution = {
  problemId: string;
  rootComponentId: string;
  nodes: SolutionNode[];
  keyTakeaways: string[];
};

export type EstimateRequest = {
  answers: { questionId: string; value: number }[];
};

export type EstimateResultEntry = {
  questionId: string;
  withinRange: boolean;
  yourValue: number;
  expectedValue: number;
  expectedRangeLabel: string;
  explanation: string;
};

export type EstimateResponse = {
  results: EstimateResultEntry[];
};

export type TradeoffRequest = {
  nodeId: string;
  optionId: string;
};

export type TradeoffResponse = {
  correct: boolean;
  chosenRationale: string;
  correctOptionId: string;
  correctLabel: string;
  correctRationale: string;
};

export type FailureQuizRequest = {
  answers: { questionId: string; optionId: string }[];
};

export type FailureQuizResultEntry = {
  questionId: string;
  correct: boolean;
  correctOptionId: string;
  explanation: string;
};

export type FailureQuizResponse = {
  results: FailureQuizResultEntry[];
};
