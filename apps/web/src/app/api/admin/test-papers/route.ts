import {
  buildCustomTestPaperRecord,
  getCustomTestPaperRecord,
  listCustomTestPaperRecords,
  saveCustomTestPaperRecord,
  type CustomTestPaperInput
} from "@/lib/interview/custom-test-papers";
import { requireAdmin } from "@/lib/server/require-admin";

export const runtime = "nodejs";

/** Admin-only CRUD for the aptitude/computer-science/AI test papers added via /admin/test-papers - mirrors
 *  api/admin/coding-problems/route.ts exactly. Public read access for mobile/web to actually take these tests
 *  lives in api/interview/templates* instead (those merge these records into the existing compiled banks). */

export async function GET(request: Request) {
  let verifiedAuth;
  try {
    verifiedAuth = await requireAdmin(request.headers.get("authorization"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Admin access required." }, { status: 403 });
  }

  try {
    const papers = await listCustomTestPaperRecords(verifiedAuth.idToken);
    return Response.json({ ok: true, papers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load test papers." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let verifiedAuth;
  try {
    verifiedAuth = await requireAdmin(request.headers.get("authorization"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Admin access required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CustomTestPaperInput;
    const existing = body?.id ? await getCustomTestPaperRecord(body.id, verifiedAuth.idToken) : null;

    const record = await buildCustomTestPaperRecord(body, {
      createdBy: existing?.createdBy ?? verifiedAuth.userId,
      existingCreatedAt: existing?.createdAt
    });

    await saveCustomTestPaperRecord(record, verifiedAuth.idToken);
    return Response.json({ ok: true, paper: record });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save this test paper." }, { status: 400 });
  }
}
