import { buildSystemDesignProblemRecord } from "@/lib/system-design/problem-builder";
import type { SystemDesignProblemSourceInput } from "@/lib/system-design/catalog.server";
import {
  getNextSystemDesignProblemOrder,
  getSystemDesignProblemRecord,
  listSystemDesignProblemRecords,
  saveSystemDesignProblemRecord
} from "@/lib/system-design/firestore";
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
    const records = await listSystemDesignProblemRecords(verifiedAuth.idToken);
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
    const body = (await request.json()) as SystemDesignProblemSourceInput;
    const existing = body?.id ? await getSystemDesignProblemRecord(body.id, verifiedAuth.idToken) : null;
    const order = existing ? existing.order : await getNextSystemDesignProblemOrder(verifiedAuth.idToken);

    const record = buildSystemDesignProblemRecord(body, {
      createdBy: existing?.createdBy ?? verifiedAuth.userId,
      existingCreatedAt: existing?.createdAt,
      order
    });

    await saveSystemDesignProblemRecord(record, verifiedAuth.idToken);
    return Response.json({ ok: true, problem: record });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save this problem." },
      { status: 400 }
    );
  }
}
