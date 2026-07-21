import { NextResponse } from "next/server";
import { listAiInterviewRoles } from "@/lib/interview/question-bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Exposes the 20 AI role definitions (id/name/summary/focusTopics/questionCount) for mobile's AI track role
 *  picker - see apps/mobile/src/lib/practiceAttempts.ts. Web reads listAiInterviewRoles() directly client-side;
 *  this route is mobile-only, same reasoning as ./templates. */
export async function GET() {
  try {
    const roles = listAiInterviewRoles();
    return NextResponse.json({ ok: true, roles });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to list AI roles." },
      { status: 500 }
    );
  }
}
