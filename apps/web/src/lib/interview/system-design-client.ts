"use client";

import { auth } from "@/lib/firebase/client";
import type {
  EstimateRequest,
  EstimateResponse,
  FailureQuizRequest,
  FailureQuizResponse,
  PublicEstimationQuestion,
  PublicFailureQuestion,
  PublicTradeoff,
  SolutionNode,
  SystemDesignProblemDetail,
  SystemDesignProblemSummary,
  SystemDesignSolution,
  TradeoffRequest,
  TradeoffResponse,
  ValidatePlacementRequest,
  ValidatePlacementResponse
} from "@/lib/system-design/types";

export type {
  EstimateRequest,
  EstimateResponse,
  FailureQuizRequest,
  FailureQuizResponse,
  PublicEstimationQuestion,
  PublicFailureQuestion,
  PublicTradeoff,
  SolutionNode,
  SystemDesignProblemDetail,
  SystemDesignProblemSummary,
  SystemDesignSolution,
  TradeoffRequest,
  TradeoffResponse,
  ValidatePlacementRequest,
  ValidatePlacementResponse
};

/** Firebase id token for the signed-in user, or null if signed out. The system-design catalog API (like the
 *  coding-catalog API - see coding-arena-client.ts's getIdToken) requires this: every /api/system-design/**
 *  route reads/writes Firestore's systemDesignProblems collection, which needs a verified signed-in user either
 *  way (Admin SDK path) or a Bearer token to satisfy firestore.rules directly (REST fallback path). */
async function getIdToken(): Promise<string | null> {
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const idToken = await getIdToken();
  if (!idToken) {
    throw new Error("Sign in to view system design problems.");
  }
  const response = await fetch(path, { headers: { authorization: `Bearer ${idToken}` }, method: "GET" });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const idToken = await getIdToken();
  if (!idToken) {
    throw new Error("Sign in to submit this answer.");
  }
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`
    },
    method: "POST"
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

export async function listSystemDesignProblems(): Promise<SystemDesignProblemSummary[]> {
  const payload = await getJson<{ problems: SystemDesignProblemSummary[] }>("/api/system-design/problems");
  return payload.problems;
}

export async function getSystemDesignProblem(problemId: string): Promise<SystemDesignProblemDetail> {
  const payload = await getJson<{ problem: SystemDesignProblemDetail }>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}`
  );
  return payload.problem;
}

export async function validateSystemDesignPlacement(
  problemId: string,
  request: ValidatePlacementRequest
): Promise<ValidatePlacementResponse> {
  const payload = await postJson<{ result: ValidatePlacementResponse }>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}/validate`,
    request
  );
  return payload.result;
}

export async function getSystemDesignSolution(problemId: string): Promise<SystemDesignSolution> {
  const payload = await getJson<{ solution: SystemDesignSolution }>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}/solution`
  );
  return payload.solution;
}

export async function checkSystemDesignEstimate(problemId: string, request: EstimateRequest): Promise<EstimateResponse> {
  const payload = await postJson<{ result: EstimateResponse }>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}/estimate`,
    request
  );
  return payload.result;
}

export async function checkSystemDesignTradeoff(problemId: string, request: TradeoffRequest): Promise<TradeoffResponse> {
  const payload = await postJson<{ result: TradeoffResponse }>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}/tradeoff`,
    request
  );
  return payload.result;
}

export async function checkSystemDesignFailureQuiz(
  problemId: string,
  request: FailureQuizRequest
): Promise<FailureQuizResponse> {
  const payload = await postJson<{ result: FailureQuizResponse }>(
    `/api/system-design/problems/${encodeURIComponent(problemId)}/failure-quiz`,
    request
  );
  return payload.result;
}
