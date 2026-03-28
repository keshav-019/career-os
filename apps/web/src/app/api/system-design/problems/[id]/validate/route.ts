import { NextRequest, NextResponse } from "next/server";
import { validatePlacement } from "@/lib/system-design/catalog.server";
import { getSystemDesignProblemRecord } from "@/lib/system-design/firestore";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";
import type { ValidatePlacementRequest } from "@/lib/system-design/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PLACED_IDS = 64;

function isValidBody(body: unknown): body is ValidatePlacementRequest {
  if (!body || typeof body !== "object") {
    return false;
  }
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.parentComponentId === "string" &&
    typeof candidate.attemptedComponentId === "string" &&
    Array.isArray(candidate.placedComponentIds) &&
    candidate.placedComponentIds.every((entry) => typeof entry === "string")
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
      return NextResponse.json(
        { ok: false, error: "Expected parentComponentId, attemptedComponentId, and placedComponentIds." },
        { status: 400 }
      );
    }

    const result = validatePlacement(record, {
      parentComponentId: body.parentComponentId,
      attemptedComponentId: body.attemptedComponentId,
      placedComponentIds: body.placedComponentIds.slice(0, MAX_PLACED_IDS)
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Unable to validate system design placement.", error);
    return NextResponse.json({ ok: false, error: "Unable to check that placement." }, { status: 500 });
  }
}
