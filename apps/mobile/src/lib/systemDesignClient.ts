import { apiGet, apiPost } from "./apiClient";
import type {
  EstimateRequest,
  EstimateResponse,
  FailureQuizRequest,
  FailureQuizResponse,
  SystemDesignProblemDetail,
  SystemDesignProblemSummary,
  SystemDesignSolution,
  TradeoffRequest,
  TradeoffResponse,
  ValidatePlacementRequest,
  ValidatePlacementResponse
} from "../types/systemDesign";

/** Thin wrapper around the same deployed /api/system-design/** routes the web app already calls from
 *  apps/web/src/lib/interview/system-design-client.ts. Every route already returns { ok, ...payload } so this
 *  unwraps that shape the same way. */

type Wrapped<T> = { ok: boolean; error?: string } & T;

export async function listSystemDesignProblems(): Promise<SystemDesignProblemSummary[]> {
  const result = await apiGet<Wrapped<{ problems: SystemDesignProblemSummary[] }>>("/api/system-design/problems");
  return result.problems;
}

export async function getSystemDesignProblem(problemId: string): Promise<SystemDesignProblemDetail> {
  const result = await apiGet<Wrapped<{ problem: SystemDesignProblemDetail }>>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}`
  );
  return result.problem;
}

export async function validateSystemDesignPlacement(
  problemId: string,
  request: ValidatePlacementRequest
): Promise<ValidatePlacementResponse> {
  const result = await apiPost<Wrapped<{ result: ValidatePlacementResponse }>>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}/validate`,
    request
  );
  return result.result;
}

export async function getSystemDesignSolution(problemId: string): Promise<SystemDesignSolution> {
  const result = await apiGet<Wrapped<{ solution: SystemDesignSolution }>>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}/solution`
  );
  return result.solution;
}

export async function checkSystemDesignEstimate(problemId: string, request: EstimateRequest): Promise<EstimateResponse> {
  const result = await apiPost<Wrapped<{ result: EstimateResponse }>>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}/estimate`,
    request
  );
  return result.result;
}

export async function checkSystemDesignTradeoff(problemId: string, request: TradeoffRequest): Promise<TradeoffResponse> {
  const result = await apiPost<Wrapped<{ result: TradeoffResponse }>>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}/tradeoff`,
    request
  );
  return result.result;
}

export async function checkSystemDesignFailureQuiz(
  problemId: string,
  request: FailureQuizRequest
): Promise<FailureQuizResponse> {
  const result = await apiPost<Wrapped<{ result: FailureQuizResponse }>>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}/failure-quiz`,
    request
  );
  return result.result;
}
