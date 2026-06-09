import { NextRequest, NextResponse } from "next/server";
import {
  getLearningTopicDetail,
  updateLearningTopicReadingContent,
  type LearningTopicFigureEdit,
  type LearningTrackId
} from "@/lib/learning/material-library";
import {
  LEARNING_ADMIN_SESSION_COOKIE,
  verifyLearningAdminSessionCookie
} from "@/lib/server/learning-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRACK_IDS: LearningTrackId[] = ["computer-science", "ai"];

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

type TopicEditPayload = {
  figures?: LearningTopicFigureEdit[];
  readingParagraphs?: string[];
  readingText?: string;
  subjectId?: string;
  topicId?: string;
  track?: string;
};

function parseReadingParagraphs(payload: TopicEditPayload): string[] {
  if (Array.isArray(payload.readingParagraphs)) {
    return payload.readingParagraphs
      .map((entry) => (typeof entry === "string" ? entry : ""))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof payload.readingText === "string") {
    return payload.readingText
      .replace(/\r/g, "")
      .split(/\n{2,}/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

export async function PATCH(request: NextRequest) {
  try {
    if (!verifyLearningAdminSessionCookie(request.cookies.get(LEARNING_ADMIN_SESSION_COOKIE)?.value)) {
      return NextResponse.json(
        { error: "Sign in as the local admin user before saving learning content." },
        { status: 401 }
      );
    }

    const payload = (await request.json().catch(() => null)) as TopicEditPayload | null;
    const track = payload?.track ?? "";
    const subjectId = payload?.subjectId ?? "";
    const topicId = payload?.topicId ?? "";

    if (!isTrackId(track) || !subjectId || !topicId) {
      return NextResponse.json(
        { error: "Missing or invalid payload. Expected track, subjectId, and topicId." },
        { status: 400 }
      );
    }

    const readingParagraphs = parseReadingParagraphs(payload ?? {});
    if (readingParagraphs.length === 0) {
      return NextResponse.json(
        { error: "Edited content is empty. Add text before saving." },
        { status: 400 }
      );
    }

    const updatedDetail = await updateLearningTopicReadingContent(
      track,
      subjectId,
      topicId,
      readingParagraphs,
      Array.isArray(payload?.figures) ? payload.figures : []
    );
    if (!updatedDetail) {
      return NextResponse.json({ error: "Topic detail not found." }, { status: 404 });
    }

    return NextResponse.json(updatedDetail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update topic detail.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
