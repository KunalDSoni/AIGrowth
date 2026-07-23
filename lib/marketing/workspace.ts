/**
 * Persistent Marketing OS workspace — generate once, mutate statuses, survive refresh.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnalyzeResult } from "@/lib/analyze/types";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { getObjectStore } from "@/lib/storage/object-store";
import {
  buildCampaignPack,
  buildChannelMix,
  buildImprovisation,
  buildMarketingOS,
  buildPlan,
  buildPositionReport,
  demoAnalyzeForMarketing,
  recommendTactics,
} from "@/lib/marketing/os";
import type {
  CampaignPack,
  MarketingOSSnapshot,
  OutreachTarget,
  PackStatus,
  PositionReport,
} from "@/lib/marketing/types";
import { renderPositionReportHtml } from "@/lib/marketing/report-html";

const DIR = join(process.cwd(), ".data", "marketing-workspaces");

export interface MarketingWorkspace {
  domain: string;
  brand: string;
  source: "live" | "demo";
  updatedAt: string;
  report: PositionReport;
  reportHtmlUrl?: string;
  packs: CampaignPack[];
  outreach: OutreachTarget[];
  channelMix: MarketingOSSnapshot["channelMix"];
  plan: MarketingOSSnapshot["plan"];
  weekly: MarketingOSSnapshot["weekly"];
  weeklyHtmlUrl?: string;
  agencyClients: MarketingOSSnapshot["agencyClients"];
  pods: MarketingOSSnapshot["pods"];
  simulations: MarketingOSSnapshot["simulations"];
  connectors: MarketingOSSnapshot["connectors"];
  agentLog: MarketingOSSnapshot["agentLog"];
  learning: MarketingOSSnapshot["learning"];
  geoDepth: MarketingOSSnapshot["geoDepth"];
  approvals: {
    planApproved: boolean;
    packsApprovedIds: string[];
  };
}

function pathFor(domain: string) {
  const key = domain.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase() || "default";
  return join(DIR, `${key}.json`);
}

export async function loadWorkspace(domain: string): Promise<MarketingWorkspace | null> {
  try {
    return JSON.parse(await readFile(pathFor(domain), "utf8")) as MarketingWorkspace;
  } catch {
    return null;
  }
}

export async function saveWorkspace(ws: MarketingWorkspace): Promise<void> {
  await mkdir(DIR, { recursive: true });
  ws.updatedAt = new Date().toISOString();
  await writeFile(pathFor(ws.domain), JSON.stringify(ws, null, 2), "utf8");
}

export async function resolveAnalyze(input: {
  domain?: string;
  useDemo?: boolean;
  analyze?: AnalyzeResult;
}): Promise<{ result: AnalyzeResult; source: "live" | "demo" }> {
  if (input.analyze) {
    const result = input.analyze;
    if (!result.intelligence) result.intelligence = buildLiveIntelligence(result);
    return { result, source: "live" };
  }
  if (input.domain && !input.useDemo) {
    const { domainKey, getProjectStore } = await import("@/lib/projects/store");
    const latest = await getProjectStore().loadLatest(domainKey(input.domain));
    if (latest) {
      if (!latest.intelligence) latest.intelligence = buildLiveIntelligence(latest);
      return { result: latest, source: "live" };
    }
  }
  const demo = demoAnalyzeForMarketing();
  demo.intelligence = buildLiveIntelligence(demo);
  return { result: demo, source: "demo" };
}

export async function generateWorkspace(input: {
  domain?: string;
  useDemo?: boolean;
  hoursPerWeek?: number;
  analyze?: AnalyzeResult;
}): Promise<MarketingWorkspace> {
  const { result, source } = await resolveAnalyze(input);
  const hours = input.hoursPerWeek ?? 8;
  const snapshot = buildMarketingOS(result, { hoursPerWeek: hours });

  // Persist a real HTML Position Report artifact
  const html = renderPositionReportHtml(snapshot.report, snapshot.packs);
  const stored = await getObjectStore().put({
    body: html,
    contentType: "text/html; charset=utf-8",
    key: `position-${result.project.domain}-${Date.now()}`,
  });

  const weeklyHtml = renderWeeklyHtml(snapshot.weekly, snapshot.report);
  const weeklyStored = await getObjectStore().put({
    body: weeklyHtml,
    contentType: "text/html; charset=utf-8",
    key: `weekly-${result.project.domain}-${Date.now()}`,
  });

  const ws: MarketingWorkspace = {
    domain: result.project.domain,
    brand: result.project.brandGuess,
    source,
    updatedAt: new Date().toISOString(),
    report: snapshot.report,
    reportHtmlUrl: stored.url,
    packs: snapshot.packs.map((p) => ({ ...p, status: "draft" })),
    outreach: snapshot.outreach,
    channelMix: snapshot.channelMix,
    plan: snapshot.plan,
    weekly: snapshot.weekly,
    weeklyHtmlUrl: weeklyStored.url,
    agencyClients: snapshot.agencyClients,
    pods: snapshot.pods,
    simulations: snapshot.simulations,
    connectors: snapshot.connectors,
    agentLog: snapshot.agentLog,
    learning: snapshot.learning,
    geoDepth: snapshot.geoDepth,
    approvals: { planApproved: false, packsApprovedIds: [] },
  };
  await saveWorkspace(ws);
  return ws;
}

export async function updatePackStatus(domain: string, packId: string, status: PackStatus) {
  const ws = await loadWorkspace(domain);
  if (!ws) throw new Error("Workspace not found. Generate the Marketing OS first.");
  const pack = ws.packs.find((p) => p.id === packId);
  if (!pack) throw new Error(`Pack not found: ${packId}`);
  pack.status = status;
  if (status === "approved" && !ws.approvals.packsApprovedIds.includes(packId)) {
    ws.approvals.packsApprovedIds.push(packId);
  }
  // Agent log trail
  ws.agentLog.unshift({
    agent: "Operator",
    status: status === "approved" || status === "shipped" ? "ok" : "needs_approval",
    summary: `Pack ${pack.packType} → ${status}`,
    at: new Date().toISOString(),
  });
  await saveWorkspace(ws);
  return ws;
}

export async function updateOutreachStatus(
  domain: string,
  targetId: string,
  status: OutreachTarget["status"],
) {
  const ws = await loadWorkspace(domain);
  if (!ws) throw new Error("Workspace not found. Generate the Marketing OS first.");
  const target = ws.outreach.find((t) => t.id === targetId);
  if (!target) throw new Error(`Outreach target not found: ${targetId}`);
  target.status = status;
  ws.agentLog.unshift({
    agent: "Outreach Agent",
    status: "needs_approval",
    summary: `${target.domain} → ${status}`,
    at: new Date().toISOString(),
  });
  await saveWorkspace(ws);
  return ws;
}

export async function approvePlan(domain: string) {
  const ws = await loadWorkspace(domain);
  if (!ws) throw new Error("Workspace not found. Generate the Marketing OS first.");
  ws.approvals.planApproved = true;
  ws.agentLog.unshift({
    agent: "Strategist",
    status: "ok",
    summary: "30/60/90 plan approved by human",
    at: new Date().toISOString(),
  });
  // Move awaiting pod forward
  for (const pod of ws.pods) {
    if (pod.status === "awaiting-approval") {
      pod.status = "running";
      pod.loopNotes.unshift("Plan approved — pack production unlocked");
    }
  }
  await saveWorkspace(ws);
  return ws;
}

export async function regeneratePack(domain: string, tacticId: string) {
  const ws = await loadWorkspace(domain);
  if (!ws) throw new Error("Workspace not found.");
  const { result } = await resolveAnalyze({ domain, useDemo: ws.source === "demo" });
  const tactic = recommendTactics(result).find((t) => t.id === tacticId) ?? recommendTactics(result)[0];
  const pack = buildCampaignPack(tactic, result);
  const idx = ws.packs.findIndex((p) => p.tacticId === tacticId);
  if (idx >= 0) ws.packs[idx] = pack;
  else ws.packs.unshift(pack);
  await saveWorkspace(ws);
  return ws;
}

function renderWeeklyHtml(
  weekly: MarketingWorkspace["weekly"],
  report: PositionReport,
): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Weekly Growth Pack — ${escape(report.brand)}</title>
  <style>body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#111}
  h1{font-size:24px} .muted{color:#666} ul{line-height:1.6}</style></head><body>
  <p class="muted">Weekly Growth Pack · ${escape(weekly.weekOf)}</p>
  <h1>${escape(report.brand)}</h1>
  <p>${escape(weekly.summary)}</p>
  <h2>Wins</h2><ul>${weekly.wins.map((w) => `<li>${escape(w)}</li>`).join("")}</ul>
  <h2>Risks</h2><ul>${weekly.risks.map((w) => `<li>${escape(w)}</li>`).join("")}</ul>
  <h2>Next actions</h2><ul>${weekly.nextActions.map((w) => `<li>${escape(w)}</li>`).join("")}</ul>
  <p class="muted">${escape(weekly.positionDelta)}</p>
  </body></html>`;
}

function escape(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// re-export helpers used by tests
export {
  recommendTactics,
  buildCampaignPack,
  buildImprovisation,
  buildPositionReport,
  buildChannelMix,
  buildPlan,
};
