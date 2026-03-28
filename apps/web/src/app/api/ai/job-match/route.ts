import type { JobRecord, ResumeVersion } from "@careeros/shared";
import { matchJobWithAi } from "@/lib/ai/career-ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      job?: Partial<JobRecord> & Record<string, unknown>;
      resumes?: ResumeVersion[];
    };

    if (!body.job) {
      return Response.json({ error: "A job payload is required." }, { status: 400 });
    }

    if (!Array.isArray(body.resumes) || body.resumes.length === 0) {
      return Response.json({ error: "At least one resume is required." }, { status: 400 });
    }

    const { model: _model, ...match } = await matchJobWithAi(body.job, body.resumes);
    return Response.json({ match, ok: true });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to analyze job fit."
      },
      { status: 503 }
    );
  }
}
