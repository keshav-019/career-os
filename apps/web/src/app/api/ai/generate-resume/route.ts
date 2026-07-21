import type { JobRecord } from "@careeros/shared";
import { generateAtsResumeWithAi } from "@/lib/ai/career-ai";
import { sanitizeProfileData } from "@/lib/profile-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      job?: Partial<JobRecord> & Record<string, unknown>;
      profile?: unknown;
    };

    if (!body.job) {
      return Response.json({ error: "A job payload is required." }, { status: 400 });
    }

    const profile = sanitizeProfileData(body.profile);
    if (!profile) {
      return Response.json({ error: "A profile payload is required." }, { status: 400 });
    }

    const { model: _model, resume } = await generateAtsResumeWithAi(profile, body.job);
    return Response.json({ ok: true, resume });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate a tailored resume."
      },
      { status: 503 }
    );
  }
}
