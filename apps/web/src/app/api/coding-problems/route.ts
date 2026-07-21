import { listCodingProblemRecords } from "@/lib/coding-catalog/firestore";
import { toPublicSummary } from "@/lib/coding-catalog/public-shapes";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let verifiedAuth;
  try {
    verifiedAuth = await verifyRequestAuth(request.headers.get("authorization"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Sign in required." }, { status: 401 });
  }

  try {
    const records = await listCodingProblemRecords(verifiedAuth.idToken);
    return Response.json({ ok: true, problems: records.map(toPublicSummary) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load coding problems." },
      { status: 503 }
    );
  }
}
