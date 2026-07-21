import {
  generateLearningPlanWithAi,
  type LearningPlanTrackInput,
  type LearningPlanWeakRowInput
} from "@/lib/ai/career-ai";

export const runtime = "nodejs";

type LearningPlanRequestBody = {
  tracks?: LearningPlanTrackInput[];
  weakRows?: LearningPlanWeakRowInput[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LearningPlanRequestBody;

    if (!Array.isArray(body.tracks) || body.tracks.length === 0) {
      return Response.json({ error: "Curriculum data is required." }, { status: 400 });
    }

    const { model: _model, ...plan } = await generateLearningPlanWithAi(body.tracks, body.weakRows ?? []);
    return Response.json({ ok: true, plan });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate a learning plan."
      },
      { status: 503 }
    );
  }
}
