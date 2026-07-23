import type { AnalyzeResult } from "@/lib/analyze/types";
import type {
  CampaignAsset,
  CampaignPack,
  Channel,
  ChannelMix,
  ImprovisationStep,
  MarketingKpi,
  MarketingOSSnapshot,
  MarketingTactic,
  PackType,
  PlanMilestone,
  PositionReport,
} from "@/lib/marketing/types";

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export function recommendTactics(result: AnalyzeResult): MarketingTactic[] {
  const tactics: MarketingTactic[] = [];
  const seo = result.seo.site.score;
  const geoRate = result.geo.brandMentionRate;
  const sample = result.geo.sampleSize;
  const critical = result.seo.site.critical;
  const brand = result.project.brandGuess;
  const services = result.intelligence?.profile.services ?? [];
  const citationGaps = result.intelligence?.citationGaps ?? [];
  const refresh = result.intelligence?.contentRefreshIds ?? [];
  const aiAccess = result.intelligence?.aiAccess ?? [];

  if (critical > 0 || seo < 70) {
    tactics.push({
      id: "tac-fix-tech",
      title: "Fix technical blockers before spend",
      channel: "site",
      rationale: `${critical} critical issues · readiness ${seo}`,
      priority: 98,
      packType: "REFRESH",
      evidenceIds: ["ev-seo-site"],
    });
  }
  if (seo < 85) {
    tactics.push({
      id: "tac-home-cro",
      title: "Proof-led homepage + CTA experiment",
      channel: "experiment",
      rationale: "Homepage conversion lift compounds all channels",
      priority: 92,
      packType: "HOME",
      evidenceIds: ["ev-seo-home"],
    });
  }
  if (services[0]) {
    tactics.push({
      id: "tac-service-page",
      title: `Ship commercial page for ${services[0]}`,
      channel: "site",
      rationale: "Money intent needs a dedicated converting URL",
      priority: 90,
      packType: "SERVICE",
      evidenceIds: ["ev-biz-services"],
    });
  }
  if (geoRate < 0.4 || sample < 5) {
    tactics.push({
      id: "tac-faq-geo",
      title: "Answer-shaped FAQ for buyer prompts",
      channel: "content",
      rationale: `GEO mention rate ${(geoRate * 100).toFixed(0)}% (n=${sample})`,
      priority: 88,
      packType: "FAQ",
      evidenceIds: ["ev-geo-run"],
    });
  }
  if (citationGaps.length || geoRate < 0.5) {
    tactics.push({
      id: "tac-outreach",
      title: "Citation outreach to source-class domains",
      channel: "outreach",
      rationale: citationGaps[0]?.title ?? "Earn third-party citations AI models reuse",
      priority: 86,
      packType: "OUTREACH",
      evidenceIds: citationGaps[0]?.evidenceIds ?? ["ev-cite"],
    });
  }
  tactics.push({
    id: "tac-local",
    title: "Local dominance pack (GBP + schema + landing)",
    channel: "local",
    rationale: `Strengthen local entity for ${brand}`,
    priority: 78,
    packType: "LOCAL",
    evidenceIds: ["ev-local"],
  });
  if (refresh.length) {
    tactics.push({
      id: "tac-refresh",
      title: "Refresh decaying content winners",
      channel: "content",
      rationale: `${refresh.length} refresh candidates in inventory`,
      priority: 74,
      packType: "REFRESH",
      evidenceIds: refresh.slice(0, 3),
    });
  }
  if (aiAccess.some((f) => f.severity === "critical" || f.severity === "warning")) {
    tactics.push({
      id: "tac-aibot",
      title: "AI crawler readiness hygiene",
      channel: "site",
      rationale: "Ensure answer engines can fetch key pages",
      priority: 72,
      packType: "SCHEMA",
      evidenceIds: ["ev-ai-access"],
    });
  }
  tactics.push({
    id: "tac-sdr",
    title: "Agency SDR: audit-led outbound sequences",
    channel: "outreach",
    rationale: "Turn Position Reports into pipeline",
    priority: 70,
    packType: "SDR",
    evidenceIds: ["ev-sdr"],
  });
  tactics.push({
    id: "tac-linkedin",
    title: "Founder LinkedIn POV series",
    channel: "linkedin",
    rationale: "Distribute proof and GEO angles on owned social",
    priority: 65,
    packType: "LINKEDIN",
    evidenceIds: ["ev-social"],
  });
  tactics.push({
    id: "tac-email",
    title: "Email nurture from service intents",
    channel: "email",
    rationale: "Convert captured demand without paid dependency",
    priority: 63,
    packType: "EMAIL-NURTURE",
    evidenceIds: ["ev-email"],
  });

  return tactics.sort((a, b) => b.priority - a.priority);
}

export function buildImprovisation(tactics: MarketingTactic[], result: AnalyzeResult): ImprovisationStep[] {
  const steps: ImprovisationStep[] = [];
  const tech = tactics.find((t) => t.id === "tac-fix-tech");
  if (tech) {
    steps.push({
      id: "step-fix-1",
      bucket: "fix",
      title: tech.title,
      detail: tech.rationale,
      effortHours: 4,
      tacticId: tech.id,
      packType: tech.packType,
      evidenceIds: tech.evidenceIds,
    });
  }
  for (const t of tactics.filter((x) => ["SERVICE", "FAQ", "HOME", "REFRESH"].includes(x.packType)).slice(0, 3)) {
    steps.push({
      id: `step-publish-${t.id}`,
      bucket: "publish",
      title: t.title,
      detail: t.rationale,
      effortHours: t.packType === "SERVICE" ? 8 : 3,
      tacticId: t.id,
      packType: t.packType,
      evidenceIds: t.evidenceIds,
    });
  }
  for (const t of tactics.filter((x) => ["OUTREACH", "SDR", "LINKEDIN", "LOCAL"].includes(x.packType)).slice(0, 3)) {
    steps.push({
      id: `step-promote-${t.id}`,
      bucket: "promote",
      title: t.title,
      detail: t.rationale,
      effortHours: 2,
      tacticId: t.id,
      packType: t.packType,
      evidenceIds: t.evidenceIds,
    });
  }
  steps.push({
    id: "step-measure-1",
    bucket: "measure",
    title: "Re-run SEO+GEO analyze in 14 days",
    detail: `Baseline readiness ${result.seo.site.score}, GEO ${(result.geo.brandMentionRate * 100).toFixed(0)}% (n=${result.geo.sampleSize})`,
    effortHours: 1,
    evidenceIds: ["ev-measure"],
  });
  return steps;
}

function asset(kind: string, title: string, body: string, claims: string[] = []): CampaignAsset {
  return { kind, title, body, claimChecks: claims };
}

export function buildCampaignPack(tactic: MarketingTactic, result: AnalyzeResult): CampaignPack {
  const brand = result.project.brandGuess;
  const service = result.intelligence?.profile.services[0] ?? "core service";
  const now = new Date().toISOString();
  const assets: CampaignAsset[] = [];

  const addCommon = () => {
    assets.push(
      asset("meta", "Meta title/description", `${brand} — ${tactic.title}\nClear, non-stuffed description for ${service}.`, [
        "No ranking guarantees",
      ]),
      asset("cta", "CTA variants (A/B)", `A: Book a consult with ${brand}\nB: Get your free Position Report\nC: See how we help with ${service}`, [
        "CTAs must match real offer",
      ]),
    );
  };

  switch (tactic.packType as PackType) {
    case "SERVICE":
      addCommon();
      assets.push(
        asset("draft", "Service page draft", `# ${service} for growing teams\n\n${brand} helps you with ${service}.\n\n## Outcomes\n- Clarity\n- Consistency\n- A clear next step\n\n**CTA:** Book a consult`),
        asset("faq", "FAQ (5)", `Q: Who is ${service} for?\nA: [CONFIRM audience]\n\nQ: How fast can we start?\nA: [CONFIRM]\n\nQ: What does it cost?\nA: [CONFIRM]\n\nQ: How is this different?\nA: [CONFIRM differentiator]\n\nQ: What happens on the first call?\nA: [CONFIRM]`),
        asset("schema", "FAQ + Service schema", `{ "@type": "Service", "name": "${service}", "provider": { "@type": "Organization", "name": "${brand}" } }`),
        asset("social", "Announce posts (3)", `1. We just clarified our ${service} offer.\n2. Who ${service} is for — and who it isn't.\n3. Proof > promises. Here's our approach.`),
      );
      break;
    case "FAQ":
      assets.push(
        asset("faq", "GEO-informed FAQs", `Questions drawn from buyer prompts around ${service}. Keep answers direct, then proof.`),
        asset("schema", "FAQ JSON-LD", `Add FAQPage schema only for visible Q&As.`),
        asset("social", "Q&A posts", `Post 1 question/answer per day for 5 days.`),
      );
      break;
    case "HOME":
      addCommon();
      assets.push(
        asset("hero", "Hero variants for bandit", `V1 Clarity\nV2 Urgency (opportunity cost)\nV3 Proof-first`),
        asset("proof", "Proof strip", `Logos / metrics / testimonials — mark [CONFIRM] for unverified numbers.`),
      );
      break;
    case "LOCAL":
      assets.push(
        asset("landing", "Local landing outline", `Unique local angles only — no doorway spam.`),
        asset("schema", "LocalBusiness schema", `NAP must match GBP.`),
        asset("gbp", "GBP posts (4)", `Offer · Proof · Community · FAQ`),
      );
      break;
    case "OUTREACH":
      assets.push(
        asset("list", "Target classes", `Associations, niche blogs, directories, tools roundups.`),
        asset("pitch", "Pitch email", `Subject: Quick resource for your readers\n\nWe published a practical ${service} checklist — happy to give your audience access.`),
        asset("followup", "Follow-ups", `Day 3 nudge · Day 7 breakup`),
      );
      break;
    case "SDR":
      assets.push(
        asset("email1", "Audit-led opener", `Noticed a few SEO/GEO gaps on {{domain}} — happy to share a short Position Report.`),
        asset("email2", "Value bump", `Top 3 improvisation steps from similar businesses.`),
        asset("linkedin", "LinkedIn note", `Short note referencing one specific gap (schema/CTA/speed).`),
      );
      break;
    case "EXPERIMENT":
      assets.push(
        asset("arms", "Bandit arms", `control / urgency / proof — sticky cookie bucketing`),
        asset("success", "Success event", `Prefer qualified lead / booked call over raw click`),
      );
      break;
    case "REFRESH":
      assets.push(
        asset("diff", "What to refresh", `Update proof, FAQs, CTAs, and answer-shaped sections.`),
        asset("promo", "Re-promo", `Email + LinkedIn announcing the update.`),
      );
      break;
    case "LINKEDIN":
      assets.push(asset("posts", "8 POV posts", `Hooks from GEO buyer questions + proof angles for ${brand}.`));
      break;
    case "EMAIL-NURTURE":
      assets.push(asset("sequence", "5-email nurture", `Welcome → problem → proof → offer → invite`));
      break;
    case "SCHEMA":
      assets.push(asset("jsonld", "Schema patches", `Organization / LocalBusiness / FAQ — validate before ship`));
      break;
    default:
      addCommon();
      assets.push(asset("brief", "Pack brief", tactic.rationale));
  }

  return {
    id: `pack-${slug(tactic.id)}`,
    packType: tactic.packType,
    tacticId: tactic.id,
    goal: tactic.title,
    status: "draft",
    assets,
    measurementPlan: "Baseline → implement → 14/30 day compare (GSC/GA4 when connected; else re-analyze).",
    effortHours: Math.max(2, Math.round(assets.length * 0.75)),
    evidenceIds: tactic.evidenceIds,
    createdAt: now,
  };
}

export function buildChannelMix(hoursPerWeek: number, tactics: MarketingTactic[]): ChannelMix[] {
  const weights: Record<Channel, number> = {
    site: 0,
    content: 0,
    email: 0,
    linkedin: 0,
    local: 0,
    outreach: 0,
    experiment: 0,
    "paid-lite": 0,
  };
  for (const t of tactics.slice(0, 8)) weights[t.channel] += t.priority;
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  return (Object.keys(weights) as Channel[])
    .map((channel) => {
      const pct = weights[channel] / total;
      return { channel, pct, hours: Math.round(hoursPerWeek * pct * 10) / 10 };
    })
    .filter((x) => x.hours > 0)
    .sort((a, b) => b.hours - a.hours);
}

export function buildPlan(tactics: MarketingTactic[]): PlanMilestone[] {
  return [
    {
      window: "30",
      title: "Fix + first converting assets",
      items: tactics.slice(0, 3).map((t) => t.title),
    },
    {
      window: "60",
      title: "Distribute + earn citations",
      items: tactics.filter((t) => ["outreach", "linkedin", "email", "local"].includes(t.channel)).slice(0, 3).map((t) => t.title),
    },
    {
      window: "90",
      title: "Compound + experiment",
      items: ["Re-measure Position Report", "Scale winning bandit arms", "Expand vertical pages"],
    },
  ];
}

export function buildPositionReport(result: AnalyzeResult, tactics: MarketingTactic[], steps: ImprovisationStep[]): PositionReport {
  const seo = result.seo.site.score;
  const geoRate = result.geo.brandMentionRate;
  const sample = result.geo.sampleSize;
  const competitors = result.intelligence?.competitors.length ?? 0;
  const pressure = competitors > 8 ? "high" : competitors > 3 ? "medium" : "low";
  const kpis: MarketingKpi[] = [
    {
      id: "seo",
      label: "SEO readiness",
      value: `${seo}`,
      previous: "—",
      deltaPct: undefined,
      hint: `${result.seo.site.pagesScanned} pages · ${result.seo.site.critical} critical`,
    },
    {
      id: "geo",
      label: "GEO mention rate",
      value: `${(geoRate * 100).toFixed(0)}%`,
      previous: "—",
      hint: `n=${sample} · ${result.geo.model}`,
    },
    {
      id: "actions",
      label: "Next actions",
      value: `${result.nextActions?.length ?? 0}`,
      hint: "Evidence-ranked",
    },
    {
      id: "tactics",
      label: "Marketing tactics",
      value: `${tactics.length}`,
      deltaPct: undefined,
      hint: "This month portfolio",
    },
  ];

  return {
    id: `rpt-${result.project.domain}`,
    brand: result.project.brandGuess,
    domain: result.project.domain,
    generatedAt: new Date().toISOString(),
    mode: "client",
    scoreboard: {
      seoReadiness: seo,
      geoMentionRate: geoRate,
      geoSampleSize: sample,
      competitorPressure: pressure,
      labels: result.intelligence?.labels ?? result.guardrails ?? [],
    },
    chapters: [
      {
        id: "search",
        title: "Search position",
        body: `Readiness ${seo}/100 across ${result.seo.site.pagesScanned} scanned pages.`,
        bullets: [
          `${result.seo.site.critical} critical · ${result.seo.site.high} high issues`,
          result.seo.site.topIssues[0]?.title ?? "No dominant top issue",
          "Improvisation prioritizes blockers before content scale",
        ],
      },
      {
        id: "geo",
        title: "Answer-engine position",
        body: `Brand mention rate ${(geoRate * 100).toFixed(0)}% across ${sample} live probes (${result.geo.model}).`,
        bullets: [
          `First-party citation share ${(result.geo.firstPartyCitationShare * 100).toFixed(0)}%`,
          sample < 5 ? "Sample size is low — treat GEO as directional" : "Sample size supports directional decisions",
          ...(result.intelligence?.citationGaps.slice(0, 2).map((g) => g.title) ?? []),
        ],
      },
      {
        id: "trust",
        title: "Trust & entity",
        body: "Proof, schema, and entity clarity affect both SEO and GEO.",
        bullets: [
          ...(result.intelligence?.aiAccess.slice(0, 2).map((f) => f.title) ?? ["AI access findings available in strategist mode"]),
          "Confirm NAP / About / Organization schema before outreach",
        ],
      },
      {
        id: "impact",
        title: "What's costing you",
        body: "Directional gaps from live evidence — not guaranteed revenue forecasts.",
        bullets: tactics.slice(0, 5).map((t) => t.title),
      },
    ],
    improvisation: steps,
    tactics,
    kpis,
  };
}

export function buildMarketingOS(
  result: AnalyzeResult,
  options: { hoursPerWeek?: number } = {},
): MarketingOSSnapshot {
  const hours = options.hoursPerWeek ?? 8;
  const tactics = recommendTactics(result);
  const improvisation = buildImprovisation(tactics, result);
  const report = buildPositionReport(result, tactics, improvisation);
  const packs = tactics.slice(0, 8).map((t) => buildCampaignPack(t, result));
  const channelMix = buildChannelMix(hours, tactics);
  const plan = buildPlan(tactics);
  const now = new Date().toISOString();

  const outreach = [
    ...(result.intelligence?.citations.byDomain ?? [])
      .filter((d) => d.classification !== "first-party")
      .slice(0, 8)
      .map((d, i) => ({
        id: `out-${i}`,
        domain: d.domain,
        class: d.classification,
        why: `Cited ×${d.count} in GEO answers — pursue as relationship/source`,
        status: "todo" as const,
        pitch: `Saw your coverage in this category — sharing a practical resource from ${result.project.brandGuess}.`,
      })),
  ];
  if (!outreach.length) {
    outreach.push(
      {
        id: "out-demo-1",
        domain: "niche-association.example",
        class: "third-party",
        why: "Source class often cited in AI answers",
        status: "todo",
        pitch: "Member resource contribution offer",
      },
      {
        id: "out-demo-2",
        domain: "industry-blog.example",
        class: "third-party",
        why: "Editorial citations transfer into answer engines",
        status: "todo",
        pitch: "Guest checklist pitch",
      },
    );
  }

  const weekly = {
    id: `week-${result.project.domain}`,
    weekOf: now.slice(0, 10),
    summary: `${result.project.brandGuess}: readiness ${result.seo.site.score}, GEO ${(result.geo.brandMentionRate * 100).toFixed(0)}% (n=${result.geo.sampleSize}).`,
    wins: packs.slice(0, 2).map((p) => `Drafted ${p.packType} pack — ${p.goal}`),
    risks: report.scoreboard.labels.slice(0, 3),
    nextActions: improvisation.slice(0, 3).map((s) => s.title),
    positionDelta: result.delta
      ? `Prior run compared ${result.delta.baselineAt.slice(0, 10)} → ${result.delta.comparisonAt.slice(0, 10)}: ${result.delta.summary}`
      : "No prior run — baseline established",
  };

  const agencyClients = [
    {
      id: "client-self",
      name: result.project.brandGuess,
      domain: result.project.domain,
      stage: "active",
      lastReportAt: now,
      score: result.seo.site.score,
    },
    {
      id: "client-pipeline-1",
      name: "Prospect A (SDR)",
      domain: "prospect-a.example",
      stage: "proposal",
      score: 58,
    },
    {
      id: "client-pipeline-2",
      name: "Prospect B (SDR)",
      domain: "prospect-b.example",
      stage: "audit-sent",
      score: 61,
    },
  ];

  const pods = [
    {
      id: `pod-${result.project.domain}`,
      clientId: "client-self",
      status: "awaiting-approval" as const,
      lastLoopAt: now,
      nextLoopAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      loopNotes: [
        "Scout refreshed SEO+GEO evidence",
        "Strategist proposed tactic deltas",
        "Awaiting human approval on packs",
      ],
    },
  ];

  const simulations = tactics.slice(0, 5).map((t) => ({
    tacticId: t.id,
    expectedLeadLiftBand: t.priority >= 90 ? "+8–18% directional" : "+3–10% directional",
    confidence: (t.priority >= 88 ? "Medium" : "Low") as "Low" | "Medium" | "High",
    assumptions: ["Traffic stable", "Offer unchanged", "GEO sample remains directional"],
    costHours: packs.find((p) => p.tacticId === t.id)?.effortHours ?? 3,
  }));

  const connectors = [
    { id: "gsc" as const, label: "Google Search Console", status: "not_configured" as const, detail: "Set GSC_SITE_URL + GSC_ACCESS_TOKEN" },
    { id: "ga4" as const, label: "GA4", status: "not_configured" as const, detail: "Connect to replace directional lead proxies" },
    { id: "wordpress" as const, label: "WordPress", status: "stub" as const, detail: "Draft push on pack approve (Phase 4)" },
    { id: "shopify" as const, label: "Shopify", status: "stub" as const, detail: "Draft push on pack approve (Phase 4)" },
    { id: "gbp" as const, label: "Google Business Profile", status: "stub" as const, detail: "Local pack publishing later" },
  ];

  const agentLog = [
    { agent: "Scout", status: "ok" as const, summary: "Loaded live analyze evidence", at: now },
    { agent: "Analyst", status: "ok" as const, summary: "Built Position Report chapters", at: now },
    { agent: "Strategist", status: "needs_approval" as const, summary: `Proposed ${tactics.length} tactics / ${hours}h capacity`, at: now },
    { agent: "Packager", status: "needs_approval" as const, summary: `Generated ${packs.length} campaign packs`, at: now },
    { agent: "Copy Chief", status: "ok" as const, summary: "Claim-check placeholders inserted", at: now },
    { agent: "Reporter", status: "ok" as const, summary: "Weekly Growth Pack drafted", at: now },
  ];

  const learning = tactics.slice(0, 6).map((t, i) => ({
    tacticId: t.id,
    score: clamp(70 - i * 4 + (t.priority - 70)),
    note: i === 0 ? "Prior boosted — high evidence fit" : "Neutral prior until outcomes recorded",
  }));

  const geoSample = result.geo.sampleSize;
  const geoMention = result.geo.brandMentionRate;
  const geoDepth = {
    whyNotCited: [
      geoSample < 5 ? "Insufficient GEO sample to assert citation failure" : "Possible weak first-party citation share",
      "Entity/NAP/schema inconsistency can suppress citations",
      "Competitors may own preferred source classes",
    ],
    answerGaps: [
      `Buyer prompts mention ${(geoMention * 100).toFixed(0)}% — expand answer-shaped sections`,
      ...(result.intelligence?.searchOpportunities.slice(0, 3).map((o) => `Gap topic: ${o.query}`) ?? []),
    ],
    citationClasses: Object.entries(
      (result.intelligence?.citations.byDomain ?? []).reduce<Record<string, number>>((acc, d) => {
        acc[d.classification] = (acc[d.classification] ?? 0) + d.count;
        return acc;
      }, {}),
    ).map(([className, count]) => ({ class: className, count })),
  };

  return {
    phaseCoverage: [1, 2, 3, 4, 5],
    report,
    channelMix,
    plan,
    packs,
    outreach,
    weekly,
    agencyClients,
    pods,
    simulations,
    connectors,
    agentLog,
    learning,
    geoDepth,
  };
}

/** Demo analyze stub when no live project exists — keeps Marketing OS usable. */
export function demoAnalyzeForMarketing(): AnalyzeResult {
  return {
    project: {
      id: "proj-demo-marketing",
      domain: "northstar.example",
      brandGuess: "Northstar Accounting",
      url: "https://northstar.example/",
    },
    seo: {
      site: {
        score: 68,
        band: "fair",
        pagesScanned: 12,
        pagesFailed: 1,
        totalIssues: 18,
        critical: 2,
        high: 5,
        quickWins: 7,
        worstPages: [],
        topIssues: [{ ruleId: "meta", title: "Weak metadata on money pages", severity: "high", count: 4 }],
      },
      pages: [],
      siteIssues: [],
      scannedAt: new Date().toISOString(),
      finalUrl: "https://northstar.example/",
      origin: "https://northstar.example",
    },
    geo: {
      runId: "geo-demo",
      model: "gemini-flash-latest",
      sampleSize: 6,
      brandMentionRate: 0.33,
      firstPartyCitationShare: 0.2,
      observations: [],
      errors: [],
      cost: { provider: "gemini", estimatedUsd: 0.02, tokens: 4000 },
    },
    evidence: [],
    nextActions: [],
    guardrails: ["GEO directional only", "Demo marketing snapshot — run live analyze for real evidence"],
    analyzedAt: new Date().toISOString(),
    intelligence: {
      profile: {
        id: "biz-demo",
        name: "Northstar Accounting",
        market: "Australia",
        industry: "Accounting",
        goal: "Generate qualified leads",
        audienceSegments: ["Medical clinics", "Founders"],
        services: ["Bookkeeping", "BAS", "Payroll"],
        differentiators: ["Plain-language advice"],
        tone: "Clear and assured",
      },
      goals: { primary: "leads", weights: { leads: 1 } },
      graph: { entities: [], relationships: [], confirmedCount: 0, inferredCount: 0 },
      pendingReview: [],
      siteInventory: { pages: [], byPurpose: {} },
      contentInventory: [],
      contentRefreshIds: ["page-tax-calendar"],
      searchOpportunities: [
        {
          id: "opp-1",
          query: "bookkeeping for medical clinics",
          topic: "Bookkeeping",
          service: "Bookkeeping",
          intent: "commercial",
          funnelStage: "consideration",
          demandProxy: 72,
          businessRelevance: 90,
          source: "demo",
          isEstimated: true,
          labels: ["Demo data", "Estimated"],
        },
      ],
      intentByQuery: [],
      topicClusters: [],
      citations: {
        firstPartyShare: 20,
        competitorShare: 45,
        thirdPartyShare: 35,
        byDomain: [
          { domain: "ato.gov.au", classification: "third-party", count: 3 },
          { domain: "rival-accountants.example", classification: "competitor", count: 2 },
        ],
      },
      citationGaps: [
        {
          id: "cg-1",
          title: "Earn citations on niche practice-management blogs",
          explanation: "Competitors appear in GEO citations more often",
          gapType: "third-party",
          confidence: "Low",
          evidenceIds: ["ev-cite"],
          recommendedAction: "Publish checklist magnet + outreach",
        },
      ],
      competitors: [],
      competitorGaps: [],
      aiAccess: [],
      promptVariants: [],
      geoMetrics: {
        mentionVariance: 0.1,
        citationStability: 0.5,
        answerConsistency: 0.6,
        sampleSize: 6,
        notes: [],
      },
      crawlDiff: null,
      campaign: null,
      labels: ["Demo marketing snapshot"],
    },
  } as unknown as AnalyzeResult;
}
