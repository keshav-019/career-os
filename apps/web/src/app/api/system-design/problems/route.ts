import { NextResponse } from "next/server";
import { toProblemSummary } from "@/lib/system-design/catalog.server";
import { listSystemDesignProblemRecords } from "@/lib/system-design/firestore";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let verifiedAuth;
  try {
    verifiedAuth = await verifyRequestAuth(request.headers.get("authorization"));
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Sign in required." }, { status: 401 });
  }

  try {
    const records = await listSystemDesignProblemRecords(verifiedAuth.idToken);
    return NextResponse.json({ ok: true, problems: records.map(toProblemSummary) });
  } catch (error) {
    console.error("Unable to list system design problems.", error);
    return NextResponse.json({ ok: false, error: "Unable to load the system design catalog." }, { status: 503 });
  }
}
