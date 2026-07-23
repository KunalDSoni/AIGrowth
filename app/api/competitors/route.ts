import { NextResponse } from "next/server";
import { z } from "zod";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { compareWithOurSeo, crawlCompetitorHomepage, type CompetitorComparison } from "@/lib/engines/competitor-crawl";
import { publicWebsiteSchema } from "@/lib/security/url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 60;

const DIR = join(process.cwd(), ".data", "competitors");

const schema = z.object({
  domain: z.string().min(1),
  competitorUrl: publicWebsiteSchema,
});

type Store = { comparisons: CompetitorComparison[] };

async function loadStore(projectDomain: string): Promise<Store> {
  try {
    const raw = await readFile(join(DIR, `${projectDomain}.json`), "utf8");
    const parsed = JSON.parse(raw) as Store;
    return { comparisons: Array.isArray(parsed.comparisons) ? parsed.comparisons : [] };
  } catch {
    return { comparisons: [] };
  }
}

export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  return NextResponse.json(await loadStore(domainKey(domain)));
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const projectDomain = domainKey(parsed.data.domain);
  const latest = await getProjectStore().loadLatest(projectDomain);
  if (!latest) return NextResponse.json({ error: "Analyze your site first" }, { status: 404 });

  try {
    const competitor = await crawlCompetitorHomepage(parsed.data.competitorUrl);
    const comparison = compareWithOurSeo(latest.seo, competitor, latest.project.domain);
    await mkdir(DIR, { recursive: true });
    const existing = await loadStore(projectDomain);
    existing.comparisons = [comparison, ...existing.comparisons].slice(0, 20);
    await writeFile(join(DIR, `${projectDomain}.json`), JSON.stringify(existing, null, 2), "utf8");
    return NextResponse.json({ comparison, comparisons: existing.comparisons });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Competitor crawl failed" },
      { status: 502 },
    );
  }
}
