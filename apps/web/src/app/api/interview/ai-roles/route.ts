import { NextRequest, NextResponse } from "next/server";
import { listAiInterviewRoles } from "@/lib/interview/question-bank";
import { requireAuthAndRateLimit } from "@/lib/server/require-auth-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Exposes the 20 AI role definitions (id/name/summary/focusTopics/questionCount) for the AI track role picker -
 *  consumed by both mobile (apps/mobile/src/lib/practiceAttempts.ts) and web (lib/interview/client.ts's
 *  fetchAiInterviewRoles(), used by app/interview-prep/page.tsx and app/admin/test-papers/TestPaperFieldForm.tsx).
 *  Web used to call listAiInterviewRoles() directly client-side, but that function now lazily loads its data from
 *  R2 with real bucket credentials server-side only, so both platforms go through this route. */
export async function GET(request: NextRequest) {
  const gate = await requireAuthAndRateLimit(request, "interview-ai-roles", { maxRequests: 60 });
  if (!gate.ok) return gate.response;

  try {
    const roles = await listAiInterviewRoles();
    return NextResponse.json({ ok: true, roles });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to list AI roles." },
      { status: 500 }
    );
  }
}
