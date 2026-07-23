import { NextResponse } from "next/server";
import { getObjectStore } from "@/lib/storage/object-store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const stored = await getObjectStore().get(id);
  if (!stored) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(stored.body), {
    status: 200,
    headers: {
      "Content-Type": stored.contentType,
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": stored.contentType.includes("pdf")
        ? `inline; filename="${stored.meta.key}"`
        : "inline",
    },
  });
}
