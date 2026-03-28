import { NextRequest, NextResponse } from "next/server";
import { toProblemDetail } from "@/lib/system-design/catalog.server";
import { getSystemDesignProblemRecord } from "@/lib/system-design/firestore";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    return NextResponse.json({ ok: true, problem: toProblemDetail(record) });
  } catch (error) {
    console.error("Unable to load system design problem.", error);
    return NextResponse.json({ ok: false, error: "Unable to load this problem." }, { status: 503 });
  }
}
