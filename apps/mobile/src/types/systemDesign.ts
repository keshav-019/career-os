// Mirrors the public (answer-free) shapes returned by apps/web/src/app/api/system-design/** - see
// apps/web/src/lib/system-design/types.ts and README.md.
export type SystemDesignDifficulty = "easy" | "medium" | "hard";

export type SystemDesignProblemSummary = {
  id: string;
  title: string;
  difficulty: SystemDesignDifficulty;
  companies: string[];
  tags: string[];
  summary: string;
};

export type PublicEstimationQuestion = { id: string; prompt: string; unit: string; placeholder?: string };
export type PublicTradeoffOption = { id: string; label: string };
export type PublicTradeoff = { nodeId: string; prompt: string; options: PublicTradeoffOption[] };
export type PublicFailureOption = { id: string; label: string };
export type PublicFailureQuestion = { id: string; prompt: string; options: PublicFailureOption[] };

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

export type ValidatePlacementResponse = {
  correct: boolean;
  alreadyComplete?: boolean;
  message: string;
  whyItFits?: string;
  progress: { placedSoFar: number; total: number };
};

export type EstimateResult = {
  questionId: string;
  withinRange: boolean;
  yourValue: number;
  expectedValue: number;
  expectedRangeLabel: string;
  explanation: string;
};

export type TradeoffResponse = {
  correct: boolean;
  chosenRationale: string;
  correctOptionId: string;
  correctLabel: string;
  correctRationale: string;
};

export type FailureQuizResult = { questionId: string; correct: boolean; correctOptionId: string; explanation: string };

export type SystemDesignSolutionNode = { componentId: string; parentComponentId: string | null; whyItFits: string };
export type SystemDesignSolution = {
  problemId: string;
  rootComponentId: string;
  nodes: SystemDesignSolutionNode[];
  keyTakeaways: string[];
};

// Request/response wrapper shapes for the POST endpoints - see apps/web/src/lib/system-design/types.ts.
export type ValidatePlacementRequest = {
  parentComponentId: string;
  attemptedComponentId: string;
  placedComponentIds: string[];
};

export type EstimateRequest = { answers: { questionId: string; value: number }[] };
export type EstimateResponse = { results: EstimateResult[] };

export type TradeoffRequest = { nodeId: string; optionId: string };

export type FailureQuizRequest = { answers: { questionId: string; optionId: string }[] };
export type FailureQuizResponse = { results: FailureQuizResult[] };
