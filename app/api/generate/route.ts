import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  type: z.string().min(1).max(80),
  context: z.string().min(1).max(10000),
  tone: z.string().min(1).max(200),
});

/**
 * Generation is only available through the evidence-grounded brief pipeline
 * (`draftFromBrief`), which requires a real scan and a configured Gemini key.
 * This endpoint previously returned mock copy written for a fictional business;
 * it now reports that generation is unavailable rather than inventing text.
 */
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 20000) return NextResponse.json({ error: "Request too large" }, { status: 413 });

  const json: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid generation request" }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        "Generation requires an evidence-grounded brief. Run a scan, then generate from a recommendation.",
      code: "NOT_CONFIGURED",
      publishReady: false,
    },
    { status: 503 },
  );
}
