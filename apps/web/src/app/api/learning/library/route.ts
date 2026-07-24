import { NextResponse } from "next/server";
import { getLearningLibrarySummary } from "@/lib/learning/material-library";
import { categoryToTrackSummary, listLearningCategoriesSafe } from "@/lib/learning/admin-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getLearningLibrarySummary();

    // Admin-added categories (apps/web/src/app/admin/learning-content) are converted into the exact same
    // TrackSummary shape as the two built-in tracks and appended here - neither client needs to know or care
    // where a track came from. Inactive categories never reach this list at all (filtered inside
    // categoryToTrackSummary/listLearningCategoriesSafe).
    const adminCategories = await listLearningCategoriesSafe();
    const adminTracks = adminCategories.filter((c) => c.active).map(categoryToTrackSummary);

    return NextResponse.json({ ...summary, tracks: [...summary.tracks, ...adminTracks] });
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
