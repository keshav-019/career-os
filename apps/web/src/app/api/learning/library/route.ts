import { NextResponse } from "next/server";
import { getLearningLibrarySummary } from "@/lib/learning/material-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getLearningLibrarySummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Unable to load learning library.", error);
    return NextResponse.json(
      {
        error: "Unable to load learning library."
      },
      { status: 500 }
    );
  }
}
