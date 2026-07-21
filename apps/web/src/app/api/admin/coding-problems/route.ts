import { buildCodingProblemRecord } from "@/lib/coding-catalog/problem-builder";
import { getCodingProblemRecord, getNextCodingProblemOrder, listCodingProblemRecords, saveCodingProblemRecord } from "@/lib/coding-catalog/firestore";
import type { CodingProblemSourceInput } from "@/lib/coding-catalog/types";
import { requireAdmin } from "@/lib/server/require-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let verifiedAuth;
  try {
    verifiedAuth = await requireAdmin(request.headers.get("authorization"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Admin access required." }, { status: 403 });
  }

  try {
    const records = await listCodingProblemRecords(verifiedAuth.idToken);
    return Response.json({ ok: true, problems: records });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load problems." }, { status: 503 });
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
    const body = (await request.json()) as CodingProblemSourceInput;
    const existing = body?.id ? await getCodingProblemRecord(body.id, verifiedAuth.idToken) : null;
    const order = existing ? existing.order : await getNextCodingProblemOrder(verifiedAuth.idToken);

    const record = buildCodingProblemRecord(body, {
      createdBy: existing?.createdBy ?? verifiedAuth.userId,
      existingCreatedAt: existing?.createdAt,
      order
    });

    await saveCodingProblemRecord(record, verifiedAuth.idToken);
    return Response.json({ ok: true, problem: record });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save this problem." },
      { status: 400 }
    );
  }
}
