import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** @deprecated Use /api/marketing/workspace */
export async function GET() {
  return NextResponse.json(
    { error: "Deprecated. Use GET /api/marketing/workspace?domain=… or POST to generate." },
    { status: 410 },
  );
}

export async function POST(request: Request) {
  // Proxy to the real workspace generate endpoint
  const body = await request.text();
  const res = await fetch(new URL("/api/marketing/workspace", request.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body || JSON.stringify({ useDemo: true }),
  });
  const data = await res.json();
  // Adapt shape for any old clients expecting { os }
  if (data.workspace) {
    return NextResponse.json({ ...data, os: data.workspace, source: data.workspace.source });
  }
  return NextResponse.json(data, { status: res.status });
}
