import { NextRequest, NextResponse } from "next/server";
import {
  LEARNING_ADMIN_SESSION_COOKIE,
  createLearningAdminSessionCookieValue,
  getClearLearningAdminCookieOptions,
  getLearningAdminCookieOptions,
  getLearningAdminConfig,
  verifyLearningAdminCredentials,
  verifyLearningAdminSessionCookie
} from "@/lib/server/learning-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LearningAdminLoginPayload = {
  password?: string;
  username?: string;
};

export async function GET(request: NextRequest) {
  const config = getLearningAdminConfig();
  return NextResponse.json({
    authenticated: verifyLearningAdminSessionCookie(request.cookies.get(LEARNING_ADMIN_SESSION_COOKIE)?.value),
    enabled: config.enabled,
    username: config.username
  });
}

export async function POST(request: NextRequest) {
  const config = getLearningAdminConfig();
  if (!config.enabled) {
    return NextResponse.json(
      {
        error: "Learning editor admin is disabled."
      },
      { status: 403 }
    );
  }

  const payload = (await request.json().catch(() => null)) as LearningAdminLoginPayload | null;
  const username = typeof payload?.username === "string" ? payload.username : "";
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!verifyLearningAdminCredentials(username, password)) {
    return NextResponse.json(
      {
        error: "Invalid admin username or password."
      },
      { status: 401 }
    );
  }

  const sessionValue = createLearningAdminSessionCookieValue(config.username);
  if (!sessionValue) {
    return NextResponse.json(
      {
        error: "Unable to create admin session."
      },
      { status: 500 }
    );
  }

  const response = NextResponse.json({
    ok: true,
    username: config.username
  });
  response.cookies.set(LEARNING_ADMIN_SESSION_COOKIE, sessionValue, getLearningAdminCookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(LEARNING_ADMIN_SESSION_COOKIE, "", getClearLearningAdminCookieOptions());
  return response;
}
