import { NextRequest, NextResponse } from "next/server";
import {
  getLearningTopicDetail,
  type LearningTrackId
} from "@/lib/learning/material-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRACK_IDS: LearningTrackId[] = ["computer-science", "system-design", "aptitude", "ai"];

function isTrackId(value: string): value is LearningTrackId {
  return TRACK_IDS.includes(value as LearningTrackId);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const track = searchParams.get("track") ?? "";
    const subjectId = searchParams.get("subjectId") ?? "";
    const topicId = searchParams.get("topicId") ?? "";

    if (!isTrackId(track) || !subjectId || !topicId) {
      return NextResponse.json(
        { error: "Missing or invalid query params. Expected track, subjectId, and topicId." },
        { status: 400 }
      );
    }

    const detail = await getLearningTopicDetail(track, subjectId, topicId);
    if (!detail) {
      return NextResponse.json({ error: "Topic detail not found." }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch {
    return NextResponse.json(
      {
        error: "Unable to load topic detail."
      },
      { status: 500 }
    );
  }
}
