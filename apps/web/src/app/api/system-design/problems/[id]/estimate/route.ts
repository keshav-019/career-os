import { NextRequest, NextResponse } from "next/server";
import { checkEstimation } from "@/lib/system-design/catalog.server";
import { getSystemDesignProblemRecord } from "@/lib/system-design/firestore";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";
import type { EstimateRequest } from "@/lib/system-design/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ANSWERS = 10;

function isValidBody(body: unknown): body is EstimateRequest {
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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let verifiedAuth;
  try {
    verifiedAuth = await verifyRequestAuth(request.headers.get("authorization"));
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Sign in required." }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const record = await getSystemDesignProblemRecord(id, verifiedAuth.idToken);
    if (!record) {
      return NextResponse.json({ ok: false, error: "Unknown system design problem." }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!isValidBody(body)) {
      return NextResponse.json({ ok: false, error: "Expected an answers array of { questionId, value }." }, { status: 400 });
    }

    const result = checkEstimation(record, { answers: body.answers.slice(0, MAX_ANSWERS) });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Unable to check estimation answers.", error);
    return NextResponse.json({ ok: false, error: "Unable to check those estimates." }, { status: 500 });
  }
}
