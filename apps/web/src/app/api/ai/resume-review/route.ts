import type { ResumeVersion } from "@careeros/shared";
import { reviewResumeWithAi } from "@/lib/ai/career-ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { resume?: ResumeVersion };

    if (!body.resume?.id) {
      return Response.json({ error: "A resume payload is required." }, { status: 400 });
    }

    const { model: _model, ...review } = await reviewResumeWithAi(body.resume);
    return Response.json({ ok: true, review });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to review resume."
      },
      { status: 503 }
    );
  }
}
