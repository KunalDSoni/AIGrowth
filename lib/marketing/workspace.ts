/**
 * Persistent Marketing OS workspace — deep engine generate, mutate, survive refresh.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnalyzeResult } from "@/lib/analyze/types";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { getObjectStore } from "@/lib/storage/object-store";
import {
  buildDeepTactics,
  richDeterministicPackFromTactic,
  runDeepMarketingEngine,
} from "@/lib/marketing/deep-engine";
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
  source: "live";
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
  siteFacts: string[];
  geminiUsed: boolean;
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

/**
 * Raised when a caller asks for analysis of a domain that has never been
 * scanned. The product must show nothing rather than invent a stand-in.
 */
export class NoProjectDataError extends Error {
  readonly domain?: string;

  constructor(domain?: string) {
    super(
      domain
        ? `No analysis data for ${domain}. Run a scan first.`
        : "No domain supplied and no analysis data available.",
    );
    this.name = "NoProjectDataError";
    this.domain = domain;
  }
}

export async function resolveAnalyze(input: {
  domain?: string;
  analyze?: AnalyzeResult;
}): Promise<{ result: AnalyzeResult; source: "live" }> {
  if (input.analyze) {
    const result = input.analyze;
    // Never clobber an existing intelligence profile (services/audiences).
    if (!result.intelligence) result.intelligence = buildLiveIntelligence(result);
    return { result, source: "live" };
  }

  if (input.domain) {
    const { domainKey, getProjectStore } = await import("@/lib/projects/store");
    const latest = await getProjectStore().loadLatest(domainKey(input.domain));
    if (latest) {
      if (!latest.intelligence) latest.intelligence = buildLiveIntelligence(latest);
      return { result: latest, source: "live" };
    }
  }

  throw new NoProjectDataError(input.domain);
}

function escapeHtml(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function renderWeeklyHtml(
  weekly: MarketingWorkspace["weekly"],
  brand: string,
  siteFacts: string[],
): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Weekly Growth Pack — ${escapeHtml(brand)}</title>
  <style>body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#111}
  h1{font-size:24px} .muted{color:#666} ul{line-height:1.6} pre{white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px;font-size:12px}</style></head><body>
  <p class="muted">Weekly Growth Pack · ${escapeHtml(weekly.weekOf)}</p>
  <h1>${escapeHtml(brand)}</h1>
  <p>${escapeHtml(weekly.summary)}</p>
  <h2>Wins</h2><ul>${weekly.wins.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
  <h2>Risks</h2><ul>${weekly.risks.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
  <h2>Next actions</h2><ul>${weekly.nextActions.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
  <p class="muted">${escapeHtml(weekly.positionDelta)}</p>
  <h2>Site facts used</h2><ul>${siteFacts.slice(0, 16).map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
  </body></html>`;
}

export async function generateWorkspace(input: {
  domain?: string;
  hoursPerWeek?: number;
  analyze?: AnalyzeResult;
  useGemini?: boolean;
}): Promise<MarketingWorkspace> {
  const { result, source } = await resolveAnalyze(input);
  const hours = input.hoursPerWeek ?? 8;
  const deep = await runDeepMarketingEngine(result, {
    hoursPerWeek: hours,
    useGemini: input.useGemini,
  });

  const html = renderPositionReportHtml(deep.report, deep.packs, deep.context.siteFacts);
  const stored = await getObjectStore().put({
    body: html,
    contentType: "text/html; charset=utf-8",
    key: `position-${result.project.domain}-${Date.now()}`,
  });

  const weekly = {
    id: `week-${result.project.domain}`,
    weekOf: new Date().toISOString().slice(0, 10),
    summary: `${deep.context.brand}: SEO ${deep.context.seoScore}, GEO ${(deep.context.geoMentionRate * 100).toFixed(0)}% (n=${deep.context.geoSample}). ${deep.packs.length} evidence-backed packs drafted.`,
    wins: deep.packs.slice(0, 3).map((p) => `${p.packType}: ${p.goal}`),
    risks: deep.context.guardrails.slice(0, 4),
    nextActions: deep.improvisation.slice(0, 4).map((s) => s.title),
    positionDelta: result.delta
      ? `Prior run ${result.delta.baselineAt.slice(0, 10)} → ${result.delta.comparisonAt.slice(0, 10)}: ${result.delta.summary}`
      : "Baseline workspace established from deep engine",
  };

  const weeklyStored = await getObjectStore().put({
    body: renderWeeklyHtml(weekly, deep.context.brand, deep.context.siteFacts),
    contentType: "text/html; charset=utf-8",
    key: `weekly-${result.project.domain}-${Date.now()}`,
  });

  const now = new Date().toISOString();
  const geminiUsed = deep.packs.some((p) => p.generation === "hybrid" || p.generation === "gemini");
  const avgChars =
    deep.packs.reduce((s, p) => s + p.assets.reduce((a, x) => a + x.body.length, 0), 0) /
    Math.max(1, deep.packs.length);

  const outreach: OutreachTarget[] = deep.context.citedOthers.slice(0, 8).map((domain, i) => ({
    id: `out-${i}`,
    domain,
    class: "third-party",
    why: `Appeared in GEO citations for ${deep.context.brand} prompts`,
    status: "todo",
    pitch: `Resource offer from ${deep.context.brand} (${deep.context.domain}) — checklist for ${deep.context.services[0]}`,
  }));
  // No invented seed targets. An empty list means no citations were observed.

  const ws: MarketingWorkspace = {
    domain: result.project.domain,
    brand: result.project.brandGuess,
    source,
    updatedAt: now,
    report: deep.report,
    reportHtmlUrl: stored.url,
    packs: deep.packs,
    outreach,
    channelMix: deep.channelMix,
    plan: deep.plan,
    weekly,
    weeklyHtmlUrl: weeklyStored.url,
    agencyClients: [
      {
        id: "client-self",
        name: deep.context.brand,
        domain: deep.context.domain,
        stage: "active",
        lastReportAt: now,
        score: deep.context.seoScore,
      },
    ],
    pods: [
      {
        id: `pod-${deep.context.domain}`,
        clientId: "client-self",
        status: "awaiting-approval",
        lastLoopAt: now,
        nextLoopAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        loopNotes: [
          `Deep engine used ${deep.context.siteFacts.length} site facts`,
          `Drafted ${deep.packs.length} claim-checked packs (${geminiUsed ? "Gemini hybrid" : "deterministic"})`,
          `Avg pack body ~${Math.round(avgChars)} chars`,
          "Awaiting human plan approval",
        ],
      },
    ],
    simulations: deep.tactics.slice(0, 5).map((t) => ({
      tacticId: t.id,
      expectedLeadLiftBand: t.priority >= 90 ? "+8–18% directional" : "+3–10% directional",
      confidence: deep.context.geoSample >= 5 ? "Medium" : "Low",
      assumptions: ["Stable traffic", "Offer unchanged", "GEO remains directional"],
      costHours: deep.packs.find((p) => p.tacticId === t.id)?.effortHours ?? 3,
    })),
    connectors: [
      {
        id: "gsc",
        label: "Google Search Console",
        status: process.env.GSC_ACCESS_TOKEN ? "connected" : "not_configured",
        detail: "Real demand when GSC_* set",
      },
      { id: "ga4", label: "GA4", status: "not_configured", detail: "Conversion truth adapter pending" },
      { id: "wordpress", label: "WordPress", status: "stub", detail: "Draft push on approve — not live yet" },
      { id: "shopify", label: "Shopify", status: "stub", detail: "Draft push on approve — not live yet" },
      { id: "gbp", label: "Google Business Profile", status: "stub", detail: "Local publishing later" },
    ],
    agentLog: [
      {
        agent: "Scout",
        status: "ok",
        summary: `Loaded ${source} evidence · ${deep.context.pagesScanned} pages · GEO n=${deep.context.geoSample} · ${deep.context.siteFacts.length} facts`,
        at: now,
      },
      {
        agent: "Analyst",
        status: "ok",
        summary: `Position Report with ${deep.report.chapters.length} chapters from crawl + GEO`,
        at: now,
      },
      {
        agent: "Strategist",
        status: "needs_approval",
        summary: `${deep.tactics.length} tactics · ${hours}h capacity · plan pending`,
        at: now,
      },
      {
        agent: "Packager",
        status: "needs_approval",
        summary: `${deep.packs.length} packs · ~${Math.round(avgChars)} chars/pack · claim-checked`,
        at: now,
      },
      {
        agent: "Copy Chief",
        status: "ok",
        summary: geminiUsed ? "Deterministic drafts + Gemini expand where applicable" : "Deterministic claim-checked drafts (no GEMINI_API_KEY)",
        at: now,
      },
      {
        agent: "Reporter",
        status: "ok",
        summary: "HTML Position + Weekly artifacts stored with evidence trail",
        at: now,
      },
    ],
    learning: deep.tactics.slice(0, 6).map((t, i) => ({
      tacticId: t.id,
      score: Math.max(40, t.priority - i * 3),
      note: t.evidenceIds.length ? "Evidence-backed prior" : "Structural prior",
    })),
    geoDepth: {
      whyNotCited: [
        deep.context.geoSample < 5 ? "Insufficient GEO sample" : "Possibly weak first-party citation share",
        deep.context.citedOthers.length
          ? `Competitors/others cited: ${deep.context.citedOthers.slice(0, 3).join(", ")}`
          : "No third-party citations in sample",
        "Entity/schema inconsistency can suppress citations",
      ],
      answerGaps: deep.context.promptsLost.slice(0, 6).length
        ? deep.context.promptsLost.slice(0, 6)
        : [`Mention rate ${(deep.context.geoMentionRate * 100).toFixed(0)}% — expand answer sections`],
      citationClasses: deep.context.citedOthers.length
        ? [{ class: "other", count: deep.context.citedOthers.length }]
        : [],
    },
    siteFacts: deep.context.siteFacts,
    geminiUsed,
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
  const blocked = pack.assets.flatMap((a) => a.claimFlags ?? []).filter((f) => f.severity === "block");
  if (status === "approved" && blocked.length) {
    throw new Error(`Cannot approve: ${blocked.length} blocking claim(s). Fix copy first.`);
  }
  pack.status = status;
  if (status === "approved" && !ws.approvals.packsApprovedIds.includes(packId)) {
    ws.approvals.packsApprovedIds.push(packId);
  }
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
  const { result } = await resolveAnalyze({ domain });
  const deep = await runDeepMarketingEngine(result, { hoursPerWeek: 8, useGemini: false });
  const tactic =
    deep.tactics.find((t) => t.id === tacticId) ??
    buildDeepTactics(deep.context).find((t) => t.id === tacticId) ??
    deep.tactics[0];
  if (!tactic) throw new Error("No tactic available to regenerate");
  const pack = richDeterministicPackFromTactic(tactic, deep.context);
  const idx = ws.packs.findIndex((p) => p.tacticId === tacticId);
  if (idx >= 0) ws.packs[idx] = pack;
  else ws.packs.unshift(pack);
  ws.siteFacts = deep.context.siteFacts;
  await saveWorkspace(ws);
  return ws;
}
