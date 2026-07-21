import { getCodingProblemRecord } from "@/lib/coding-catalog/firestore";
import { toPublicDetail } from "@/lib/coding-catalog/public-shapes";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ problemId: string }> }) {
  try {
    await verifyRequestAuth(request.headers.get("authorization"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Sign in required." }, { status: 401 });
  }

  try {
    const { problemId } = await params;
    const record = await getCodingProblemRecord(problemId);
    if (!record) {
      return Response.json({ error: "Unknown problem." }, { status: 404 });
    }

    return Response.json({ ok: true, problem: toPublicDetail(record) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load this problem." },
      { status: 503 }
    );
  }
}
