import { getAiStatus } from "@/lib/ai/career-ai";

export const runtime = "nodejs";

export async function GET() {
  const status = await getAiStatus();
  return Response.json(
    {
      available: status.available,
      checkedAt: status.checkedAt,
      message: status.available ? "Career intelligence is ready." : status.message
    },
    { status: status.available ? 200 : 503 }
  );
}
