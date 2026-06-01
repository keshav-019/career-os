import { normalizeJobImport, type JobSourcePayload } from "@careeros/shared";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = (await request.json()) as JobSourcePayload;

  if (!payload.title && !payload.sourceUrl) {
    return NextResponse.json(
      { error: "A job title or source URL is required." },
      { status: 400 }
    );
  }

  const draft = normalizeJobImport(payload);

  return NextResponse.json(
    {
      draft,
      persistence: "mock"
    },
    { status: 202 }
  );
}
