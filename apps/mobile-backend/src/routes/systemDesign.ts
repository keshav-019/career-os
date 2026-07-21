import { Router } from "express";
import {
  checkEstimation,
  checkFailureQuiz,
  checkTradeoff,
  getCatalogSolution,
  toProblemDetail,
  toProblemSummary,
  validatePlacement
} from "@/lib/system-design/catalog.server";
import { getSystemDesignProblemRecord, listSystemDesignProblemRecords } from "@/lib/system-design/firestore";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";
import type { EstimateRequest, FailureQuizRequest, TradeoffRequest, ValidatePlacementRequest } from "@/lib/system-design/types";

/**
 * Express port of apps/web/src/app/api/system-design/problems/**\/route.ts - same imports, same logic, only the
 * Next.js request/response plumbing is swapped for Express. See apps/mobile-backend/README.md.
 */

const router = Router();
const MAX_PLACED_IDS = 64;
const MAX_ANSWERS = 10;

async function requireAuth(req: import("express").Request): Promise<{ idToken: string } | null> {
  try {
    return await verifyRequestAuth((req.headers.authorization as string) ?? null);
  } catch {
    return null;
  }
}

function isValidPlacementBody(body: unknown): body is ValidatePlacementRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.parentComponentId === "string" &&
    typeof candidate.attemptedComponentId === "string" &&
    Array.isArray(candidate.placedComponentIds) &&
    candidate.placedComponentIds.every((entry) => typeof entry === "string")
  );
}

function isValidEstimateBody(body: unknown): body is EstimateRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    Array.isArray(candidate.answers) &&
    candidate.answers.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as Record<string, unknown>).questionId === "string" &&
        typeof (entry as Record<string, unknown>).value === "number" &&
        Number.isFinite((entry as Record<string, unknown>).value)
    )
  );
}

function isValidTradeoffBody(body: unknown): body is TradeoffRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.nodeId === "string" && typeof candidate.optionId === "string";
}

function isValidFailureQuizBody(body: unknown): body is FailureQuizRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    Array.isArray(candidate.answers) &&
    candidate.answers.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as Record<string, unknown>).questionId === "string" &&
        typeof (entry as Record<string, unknown>).optionId === "string"
    )
  );
}

router.get("/problems", async (req, res) => {
  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: "Sign in required." });

  try {
    const records = await listSystemDesignProblemRecords(auth.idToken);
    res.json({ ok: true, problems: records.map(toProblemSummary) });
  } catch (error) {
    console.error("Unable to list system design problems.", error);
    res.status(503).json({ ok: false, error: "Unable to load the system design catalog." });
  }
});

router.get("/problems/:id", async (req, res) => {
  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: "Sign in required." });

  try {
    const record = await getSystemDesignProblemRecord(req.params.id, auth.idToken);
    if (!record) return res.status(404).json({ ok: false, error: "Unknown system design problem." });
    res.json({ ok: true, problem: toProblemDetail(record) });
  } catch (error) {
    console.error("Unable to load system design problem.", error);
    res.status(503).json({ ok: false, error: "Unable to load this problem." });
  }
});

router.post("/problems/:id/validate", async (req, res) => {
  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: "Sign in required." });

  try {
    const record = await getSystemDesignProblemRecord(req.params.id, auth.idToken);
    if (!record) return res.status(404).json({ ok: false, error: "Unknown system design problem." });

    const body = req.body;
    if (!isValidPlacementBody(body)) {
      return res
        .status(400)
        .json({ ok: false, error: "Expected parentComponentId, attemptedComponentId, and placedComponentIds." });
    }

    const result = validatePlacement(record, {
      parentComponentId: body.parentComponentId,
      attemptedComponentId: body.attemptedComponentId,
      placedComponentIds: body.placedComponentIds.slice(0, MAX_PLACED_IDS)
    });

    res.json({ ok: true, result });
  } catch (error) {
    console.error("Unable to validate system design placement.", error);
    res.status(500).json({ ok: false, error: "Unable to check that placement." });
  }
});

router.get("/problems/:id/solution", async (req, res) => {
  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: "Sign in required." });

  try {
    const record = await getSystemDesignProblemRecord(req.params.id, auth.idToken);
    if (!record) return res.status(404).json({ ok: false, error: "Unknown system design problem." });
    res.json({ ok: true, solution: getCatalogSolution(record) });
  } catch (error) {
    console.error("Unable to load system design solution.", error);
    res.status(500).json({ ok: false, error: "Unable to load the solution." });
  }
});

router.post("/problems/:id/estimate", async (req, res) => {
  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: "Sign in required." });

  try {
    const record = await getSystemDesignProblemRecord(req.params.id, auth.idToken);
    if (!record) return res.status(404).json({ ok: false, error: "Unknown system design problem." });

    const body = req.body;
    if (!isValidEstimateBody(body)) {
      return res.status(400).json({ ok: false, error: "Expected an answers array of { questionId, value }." });
    }

    const result = checkEstimation(record, { answers: body.answers.slice(0, MAX_ANSWERS) });
    res.json({ ok: true, result });
  } catch (error) {
    console.error("Unable to check estimation answers.", error);
    res.status(500).json({ ok: false, error: "Unable to check those estimates." });
  }
});

router.post("/problems/:id/tradeoff", async (req, res) => {
  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: "Sign in required." });

  try {
    const record = await getSystemDesignProblemRecord(req.params.id, auth.idToken);
    if (!record) return res.status(404).json({ ok: false, error: "Unknown system design problem." });

    const body = req.body;
    if (!isValidTradeoffBody(body)) {
      return res.status(400).json({ ok: false, error: "Expected nodeId and optionId." });
    }

    const result = checkTradeoff(record, body);
    if (!result) return res.status(404).json({ ok: false, error: "No tradeoff question found for that node." });
    res.json({ ok: true, result });
  } catch (error) {
    console.error("Unable to check tradeoff answer.", error);
    res.status(500).json({ ok: false, error: "Unable to check that answer." });
  }
});

router.post("/problems/:id/failure-quiz", async (req, res) => {
  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: "Sign in required." });

  try {
    const record = await getSystemDesignProblemRecord(req.params.id, auth.idToken);
    if (!record) return res.status(404).json({ ok: false, error: "Unknown system design problem." });

    const body = req.body;
    if (!isValidFailureQuizBody(body)) {
      return res.status(400).json({ ok: false, error: "Expected an answers array of { questionId, optionId }." });
    }

    const result = checkFailureQuiz(record, { answers: body.answers.slice(0, MAX_ANSWERS) });
    res.json({ ok: true, result });
  } catch (error) {
    console.error("Unable to check failure-quiz answers.", error);
    res.status(500).json({ ok: false, error: "Unable to check those answers." });
  }
});

export default router;
