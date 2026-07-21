import { NextRequest, NextResponse } from "next/server";
import { checkTradeoff } from "@/lib/system-design/catalog.server";
import { getSystemDesignProblemRecord } from "@/lib/system-design/firestore";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";
import type { TradeoffRequest } from "@/lib/system-design/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidBody(body: unknown): body is TradeoffRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.nodeId === "string" && typeof candidate.optionId === "string";
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
      return NextResponse.json({ ok: false, error: "Expected nodeId and optionId." }, { status: 400 });
    }

    const result = checkTradeoff(record, body);
    if (!result) {
      return NextResponse.json({ ok: false, error: "No tradeoff question found for that node." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Unable to check tradeoff answer.", error);
    return NextResponse.json({ ok: false, error: "Unable to check that answer." }, { status: 500 });
  }
}
