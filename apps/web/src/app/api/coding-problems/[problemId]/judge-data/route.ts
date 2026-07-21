import { getCodingProblemRecord } from "@/lib/coding-catalog/firestore";
import { toJudgeData } from "@/lib/coding-catalog/public-shapes";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";

export const runtime = "nodejs";

/**
 * Returns harness + hidden tests - the data the LOCAL judge needs to actually compile/run a submission. This must
 * only ever be called by the desktop app's local helper server (a separate OS process forwarding the signed-in
 * user's Firebase id token), never fetched directly from the browser bundle. Signed-in is sufficient here (not
 * admin-only) since any user needs this to solve/submit problems - the protection is "you must be a real signed-in
 * user", not "you must be an admin".
 */
export async function GET(request: Request, { params }: { params: Promise<{ problemId: string }> }) {
  let verifiedAuth;
  try {
    verifiedAuth = await verifyRequestAuth(request.headers.get("authorization"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Sign in required." }, { status: 401 });
  }

  try {
    const { problemId } = await params;
    const record = await getCodingProblemRecord(problemId, verifiedAuth.idToken);
    if (!record) {
      return Response.json({ error: "Unknown problem." }, { status: 404 });
    }

    return Response.json({ ok: true, problem: toJudgeData(record) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load judge data for this problem." },
      { status: 503 }
    );
  }
}
