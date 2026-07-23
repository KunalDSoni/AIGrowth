import { NextResponse } from "next/server";
import { z } from "zod";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const DIR = join(process.cwd(), ".data", "marketing");

const patchSchema = z.object({
  kind: z.enum(["pack", "outreach", "pod"]),
  id: z.string(),
  status: z.string(),
  domain: z.string().default("default"),
});

async function loadState(domain: string) {
  try {
    return JSON.parse(await readFile(join(DIR, `${domain}.json`), "utf8")) as Record<string, unknown>;
  } catch {
    return { packs: {}, outreach: {}, pods: {} };
  }
}

export async function POST(request: Request) {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await mkdir(DIR, { recursive: true });
  const state = await loadState(parsed.data.domain);
  const bucket = parsed.data.kind === "pack" ? "packs" : parsed.data.kind === "outreach" ? "outreach" : "pods";
  const map = (state[bucket] as Record<string, string>) ?? {};
  map[parsed.data.id] = parsed.data.status;
  state[bucket] = map;
  state.updatedAt = new Date().toISOString();
  await writeFile(join(DIR, `${parsed.data.domain}.json`), JSON.stringify(state, null, 2), "utf8");
  return NextResponse.json({ ok: true, state });
}

export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain") ?? "default";
  return NextResponse.json(await loadState(domain));
}
