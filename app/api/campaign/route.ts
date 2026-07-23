import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildCampaign,
  canPublish,
  decideGate,
  exportCampaign,
  setTaskStatus,
  type Campaign,
  type GateState,
  type TaskStatus,
} from "@/lib/engines/campaign";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { loadBusinessOverrides } from "@/lib/projects/business-profile";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dataDir } from "@/lib/storage/data-dir";

export const runtime = "nodejs";

const CAMPAIGN_DIR = dataDir("campaigns");

async function loadCampaign(domain: string): Promise<Campaign | null> {
  try {
    const raw = await readFile(join(CAMPAIGN_DIR, `${domainKey(domain)}.json`), "utf8");
    return JSON.parse(raw) as Campaign;
  } catch {
    return null;
  }
}

async function saveCampaign(domain: string, campaign: Campaign) {
  await mkdir(CAMPAIGN_DIR, { recursive: true });
  await writeFile(join(CAMPAIGN_DIR, `${domainKey(domain)}.json`), JSON.stringify(campaign, null, 2), "utf8");
}

const bodySchema = z.object({
  domain: z.string().min(1),
  rebuild: z.boolean().optional(),
  taskId: z.string().optional(),
  taskStatus: z.enum(["todo", "in-progress", "blocked", "done"]).optional(),
  gateId: z.string().optional(),
  gateState: z.enum(["pending", "approved", "rejected"]).optional(),
  export: z.boolean().optional(),
  baseUrl: z.string().url().optional(),
});

export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  const campaign = await loadCampaign(domain);
  return NextResponse.json({ campaign, canPublish: campaign ? canPublish(campaign) : false });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const domain = domainKey(parsed.data.domain);
  const store = getProjectStore();
  const latest = await store.loadLatest(domain);
  if (!latest) return NextResponse.json({ error: "Analyze first" }, { status: 404 });

  let campaign = await loadCampaign(domain);

  if (!campaign || parsed.data.rebuild) {
    const overrides = await loadBusinessOverrides(domain);
    const intel = buildLiveIntelligence(latest, overrides ?? undefined, latest.nextActions);
    campaign =
      intel.campaign ??
      buildCampaign({
        name: `${latest.project.brandGuess} growth sprint`,
        objective: intel.profile.goal,
        recommendations: latest.nextActions.slice(0, 5).map((a) => ({
          id: a.id,
          title: a.title,
          assetType: a.source === "technical" ? "fix" : "content",
        })),
      });
    await saveCampaign(domain, campaign);
  }

  if (parsed.data.taskId && parsed.data.taskStatus) {
    campaign = setTaskStatus(campaign, parsed.data.taskId, parsed.data.taskStatus as TaskStatus);
    await saveCampaign(domain, campaign);
  }

  if (parsed.data.gateId && parsed.data.gateState) {
    campaign = decideGate(campaign, parsed.data.gateId, parsed.data.gateState as GateState, "operator");
    await saveCampaign(domain, campaign);
  }

  if (parsed.data.export) {
    const handoff = exportCampaign(campaign, parsed.data.baseUrl ?? latest.project.url);
    return NextResponse.json({ campaign, handoff, canPublish: canPublish(campaign) });
  }

  return NextResponse.json({ campaign, canPublish: canPublish(campaign) });
}
