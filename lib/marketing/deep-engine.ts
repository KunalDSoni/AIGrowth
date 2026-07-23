/**
 * Deep Marketing Engine — evidence in, claim-checked campaign packs out.
 * Uses crawl + GEO + next-actions. Gemini expands drafts when configured.
 */

import type { AnalyzeResult } from "@/lib/analyze/types";
import type { RankedCandidate } from "@/lib/engines/recommendation-bus";
import { validateClaims, type ClaimFlag } from "@/lib/engines/claim-validation";
import { GeminiNotConfiguredError, GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";
import type {
  CampaignAsset,
  CampaignPack,
  ChannelMix,
  ImprovisationStep,
  MarketingKpi,
  MarketingTactic,
  PackType,
  PlanMilestone,
  PositionReport,
} from "@/lib/marketing/types";

export interface SiteContext {
  brand: string;
  domain: string;
  url: string;
  seoScore: number;
  critical: number;
  high: number;
  pagesScanned: number;
  topIssues: string[];
  pageSummaries: string[];
  services: string[];
  audiences: string[];
  geoMentionRate: number;
  geoSample: number;
  geoModel: string;
  promptsWon: string[];
  promptsLost: string[];
  citedOthers: string[];
  nextActions: RankedCandidate[];
  guardrails: string[];
  siteFacts: string[];
}

export interface DeepPackAsset extends CampaignAsset {
  claimFlags: ClaimFlag[];
}

export interface DeepCampaignPack extends Omit<CampaignPack, "assets"> {
  assets: DeepPackAsset[];
  siteFactsUsed: string[];
  generation: "deterministic" | "gemini" | "hybrid";
}

export interface DeepMarketingResult {
  context: SiteContext;
  report: PositionReport;
  tactics: MarketingTactic[];
  improvisation: ImprovisationStep[];
  packs: DeepCampaignPack[];
  channelMix: ChannelMix[];
  plan: PlanMilestone[];
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export function extractSiteContext(result: AnalyzeResult): SiteContext {
  const pages = result.seo.pages.filter((p) => p.ok);
  const services =
    result.intelligence?.profile.services?.filter((s) => !/confirm/i.test(s) && s.length > 2) ?? [];
  const audiences = result.intelligence?.profile.audienceSegments?.filter((s) => !/confirm|researching this category/i.test(s)) ?? [];
  const promptsWon = result.geo.observations.filter((o) => o.brandMentioned).map((o) => o.prompt);
  const promptsLost = result.geo.observations.filter((o) => !o.brandMentioned && !o.error).map((o) => o.prompt);
  const citedOthers = [
    ...new Set(
      result.geo.observations.flatMap((o) =>
        o.citations.filter((c) => c.classification === "other").map((c) => c.domain),
      ),
    ),
  ].slice(0, 12);

  const siteFacts = [
    `Brand: ${result.project.brandGuess}`,
    `Domain: ${result.project.domain}`,
    `URL: ${result.project.url}`,
    `SEO readiness: ${result.seo.site.score}/100 (${result.seo.site.band})`,
    `Pages scanned: ${result.seo.site.pagesScanned} · failed: ${result.seo.site.pagesFailed}`,
    `Critical issues: ${result.seo.site.critical} · High: ${result.seo.site.high}`,
    ...result.seo.site.topIssues.slice(0, 5).map((i) => `Issue: ${i.title} (${i.severity}, ×${i.count})`),
    ...pages.slice(0, 8).map((p) => `Page ${p.metrics.score}/100: ${p.title ?? p.finalUrl}`),
    `GEO model: ${result.geo.model} · n=${result.geo.sampleSize}`,
    `GEO mention rate: ${result.geo.brandMentionRate.toFixed(0)}%`,
    `First-party citation share: ${result.geo.firstPartyCitationShare.toFixed(0)}%`,
    ...promptsWon.slice(0, 4).map((p) => `GEO win prompt: ${p}`),
    ...promptsLost.slice(0, 4).map((p) => `GEO miss prompt: ${p}`),
    ...citedOthers.slice(0, 6).map((d) => `Cited other domain: ${d}`),
    ...(services.length ? [`Services: ${services.join(", ")}`] : []),
    ...(audiences.length ? [`Audiences: ${audiences.join(", ")}`] : []),
  ];

  return {
    brand: result.project.brandGuess,
    domain: result.project.domain,
    url: result.project.url,
    seoScore: result.seo.site.score,
    critical: result.seo.site.critical,
    high: result.seo.site.high,
    pagesScanned: result.seo.site.pagesScanned,
    topIssues: result.seo.site.topIssues.map((i) => i.title),
    pageSummaries: pages.slice(0, 8).map((p) => `${p.title ?? p.url} (${p.metrics.score})`),
    services: services.length ? services : ["core service"],
    audiences: audiences.length ? audiences : ["buyers researching this category"],
    geoMentionRate: result.geo.brandMentionRate,
    geoSample: result.geo.sampleSize,
    geoModel: result.geo.model,
    promptsWon,
    promptsLost,
    citedOthers,
    nextActions: result.nextActions ?? [],
    guardrails: result.guardrails ?? result.intelligence?.labels ?? [],
    siteFacts,
  };
}

function packTypeForAction(action: RankedCandidate): PackType {
  if (action.source === "technical") return "REFRESH";
  if (/faq/i.test(action.title) || /faq/i.test(action.action)) return "FAQ";
  if (/home|cta|hero|conversion/i.test(action.title)) return "HOME";
  if (action.source === "citation") return "OUTREACH";
  if (action.source === "ai-visibility") return "ANSWER";
  if (/local|gbp|geo city/i.test(action.title)) return "LOCAL";
  return "SERVICE";
}

export function buildDeepTactics(ctx: SiteContext): MarketingTactic[] {
  const tactics: MarketingTactic[] = [];

  // 1) From live next actions (highest fidelity)
  for (const action of ctx.nextActions.slice(0, 8)) {
    tactics.push({
      id: `tac-action-${slug(action.id)}`,
      title: action.title,
      channel:
        action.source === "technical"
          ? "site"
          : action.source === "citation"
            ? "outreach"
            : action.source === "ai-visibility"
              ? "content"
              : "site",
      rationale: `${action.action} · score ${action.priorityScore} · evidence ${action.evidenceIds.join(", ") || "none"}`,
      priority: clamp(action.priorityScore),
      packType: packTypeForAction(action),
      evidenceIds: action.evidenceIds,
    });
  }

  // 2) Structural gaps if next-actions thin
  if (ctx.critical > 0) {
    tactics.push({
      id: "tac-fix-critical",
      title: `Clear ${ctx.critical} critical SEO blockers`,
      channel: "site",
      rationale: ctx.topIssues.slice(0, 3).join(" · ") || "Critical technical debt",
      priority: 97,
      packType: "REFRESH",
      evidenceIds: ["ev-seo-site"],
    });
  }
  if (ctx.promptsLost.length) {
    tactics.push({
      id: "tac-geo-misses",
      title: "Close GEO miss prompts with answer-shaped content",
      channel: "content",
      rationale: `Missed: ${ctx.promptsLost.slice(0, 2).join(" | ")}`,
      priority: 90,
      packType: "FAQ",
      evidenceIds: ["ev-geo-run"],
    });
  }
  if (ctx.citedOthers.length) {
    tactics.push({
      id: "tac-cite-outreach",
      title: "Citation outreach to domains AI already trusts",
      channel: "outreach",
      rationale: `Targets: ${ctx.citedOthers.slice(0, 4).join(", ")}`,
      priority: 88,
      packType: "OUTREACH",
      evidenceIds: ["ev-cite"],
    });
  }
  // Always ensure a baseline portfolio even when analyze is thin
  const ensure: Array<{ id: string; title: string; channel: MarketingTactic["channel"]; packType: PackType; priority: number; rationale: string }> = [
    {
      id: "tac-service-money",
      title: `Commercial page / offer clarity for ${ctx.services[0]}`,
      channel: "site",
      packType: "SERVICE",
      priority: 86,
      rationale: `Audience: ${ctx.audiences[0] ?? "buyers"}`,
    },
    {
      id: "tac-faq-geo",
      title: "GEO-informed FAQ / answer page",
      channel: "content",
      packType: "FAQ",
      priority: 84,
      rationale: ctx.promptsLost[0] ?? `Mention rate ${ctx.geoMentionRate.toFixed(0)}% — expand answers`,
    },
    {
      id: "tac-home-experiment",
      title: "Homepage proof + CTA bandit experiment",
      channel: "experiment",
      packType: "HOME",
      priority: 82,
      rationale: `Readiness ${ctx.seoScore}; test clarity vs proof vs urgency`,
    },
    {
      id: "tac-cite-outreach",
      title: "Citation outreach to domains AI already trusts",
      channel: "outreach",
      packType: "OUTREACH",
      priority: 80,
      rationale: ctx.citedOthers.length
        ? `Targets: ${ctx.citedOthers.slice(0, 4).join(", ")}`
        : "Seed industry publications until live citations appear",
    },
    {
      id: "tac-refresh-tech",
      title: ctx.critical > 0 ? `Clear ${ctx.critical} critical SEO blockers` : "Refresh weakest money-page metadata",
      channel: "site",
      packType: "REFRESH",
      priority: ctx.critical > 0 ? 97 : 78,
      rationale: ctx.topIssues.slice(0, 3).join(" · ") || "Technical / content debt",
    },
    {
      id: "tac-linkedin-dist",
      title: "Distribute proof angles on LinkedIn",
      channel: "linkedin",
      packType: "LINKEDIN",
      priority: 70,
      rationale: "Owned channel distribution for GEO/SEO themes",
    },
    {
      id: "tac-answer-engine",
      title: "Answer-engine entity + FAQ schema pass",
      channel: "content",
      packType: "ANSWER",
      priority: 76,
      rationale: `GEO model ${ctx.geoModel} · n=${ctx.geoSample}`,
    },
    {
      id: "tac-local",
      title: "Local landing + GBP consistency (if applicable)",
      channel: "local",
      packType: "LOCAL",
      priority: 68,
      rationale: "Only ship with unique local proof — no doorway pages",
    },
  ];

  for (const e of ensure) {
    if (tactics.some((t) => t.packType === e.packType || t.id === e.id)) continue;
    tactics.push({
      id: e.id,
      title: e.title,
      channel: e.channel,
      rationale: e.rationale,
      priority: e.priority,
      packType: e.packType,
      evidenceIds: ["ev-baseline"],
    });
  }

  // Dedupe by title similarity
  const seen = new Set<string>();
  return tactics
    .sort((a, b) => b.priority - a.priority)
    .filter((t) => {
      const key = `${t.packType}:${t.title.toLowerCase().slice(0, 36)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function asset(kind: string, title: string, body: string, extraClaims: string[] = []): DeepPackAsset {
  const flags = validateClaims(body);
  return {
    kind,
    title,
    body,
    claimChecks: [
      ...extraClaims,
      ...flags.map((f) => `${f.severity.toUpperCase()}: ${f.reason} (“${f.text}”)`),
    ],
    claimFlags: flags,
  };
}

export function richDeterministicPackFromTactic(tactic: MarketingTactic, ctx: SiteContext): DeepCampaignPack {
  return richDeterministicPack(tactic, ctx);
}

function richDeterministicPack(tactic: MarketingTactic, ctx: SiteContext): DeepCampaignPack {
  const service = ctx.services[0] ?? "service";
  const audience = ctx.audiences[0] ?? "buyers";
  const factsBlock = ctx.siteFacts.slice(0, 12).map((f) => `- ${f}`).join("\n");
  const now = new Date().toISOString();
  const assets: DeepPackAsset[] = [];

  const brief = `OBJECTIVE
${tactic.title}

WHY (evidence)
${tactic.rationale}

SITE FACTS (do not invent beyond these)
${factsBlock}

GUARDRAILS
${ctx.guardrails.map((g) => `- ${g}`).join("\n") || "- No fake rankings or guarantees"}
`;

  assets.push(asset("brief", "Evidence brief", brief, ["Draft must stay inside site facts"]));

  switch (tactic.packType) {
    case "SERVICE": {
      const draft = `# ${service} for ${audience}

## Who this is for
${audience} evaluating ${service} from ${ctx.brand} (${ctx.domain}).

## What you get
- Clear scope for ${service}
- A defined next step (consultation / onboarding)
- [CONFIRM: deliverables unique to the business]

## How it works
1. Discovery call
2. Proposal with scope
3. Kickoff
[CONFIRM: actual process steps]

## Proof
Use only verified proof. Current crawl does not authorize invented case studies.
Pages observed: ${ctx.pageSummaries.slice(0, 3).join("; ") || "n/a"}

## FAQ
**Who is this for?** ${audience}.
**How do we start?** [CONFIRM: booking link / contact].
**What makes ${ctx.brand} different?** [CONFIRM: differentiator — do not invent].

## CTA
Book a consultation with ${ctx.brand}.
`;
      assets.push(asset("draft", "Full service page draft", draft));
      assets.push(
        asset(
          "meta",
          "Title + meta",
          `Title: ${service} for ${audience} | ${ctx.brand}\nMeta: Practical ${service} for ${audience}. Talk to ${ctx.brand} about the next step.`,
        ),
      );
      assets.push(
        asset(
          "schema",
          "Service JSON-LD (draft)",
          JSON.stringify(
            {
              "@context": "https://schema.org",
              "@type": "Service",
              name: service,
              provider: { "@type": "Organization", name: ctx.brand, url: ctx.url },
              areaServed: "CONFIRM",
            },
            null,
            2,
          ),
        ),
      );
      assets.push(
        asset(
          "social",
          "Launch posts (3)",
          `1. We clarified our ${service} offer for ${audience}.\n2. What ${service} includes (and what it doesn't) — from ${ctx.brand}.\n3. If you're researching ${service}, start here: ${ctx.url}`,
        ),
      );
      break;
    }
    case "FAQ": {
      const qs = (ctx.promptsLost.length ? ctx.promptsLost : ctx.promptsWon).slice(0, 6);
      const faqBody =
        qs.length > 0
          ? qs
              .map(
                (q, i) =>
                  `### ${i + 1}. ${q}\nShort answer grounded in what ${ctx.brand} actually offers.\n[CONFIRM: precise answer — do not invent pricing/results]\n`,
              )
              .join("\n")
          : `### 1. What does ${ctx.brand} help with?\n[CONFIRM]\n\n### 2. Who is a fit?\n${audience}.\n\n### 3. How do we start?\n[CONFIRM]`;
      assets.push(asset("faq", "GEO-informed FAQ draft", `# Questions buyers ask\n\n${faqBody}`));
      assets.push(asset("schema", "FAQPage schema notes", "Only mark up Q&As visible on the page. No hidden FAQ spam."));
      break;
    }
    case "HOME": {
      assets.push(
        asset(
          "hero",
          "Hero variants for bandit (A/B/C)",
          `A — Clarity\nHeadline: ${ctx.brand} helps ${audience} with ${service}.\nCTA: Talk to us\n\nB — Proof-first\nHeadline: Practical ${service} with clear next steps.\nCTA: See how it works\n\nC — Opportunity cost\nHeadline: Stop guessing your next growth move.\nCTA: Get a Position Report\n\nRules: no “#1”, no invented metrics.`,
        ),
      );
      assets.push(
        asset(
          "proof",
          "Proof strip plan",
          `Pull only real signals from crawl/reviews.\nObserved pages: ${ctx.pageSummaries.join("; ") || "none"}\nSEO score ${ctx.seoScore}. Do not fabricate logos or %, use [CONFIRM].`,
        ),
      );
      break;
    }
    case "OUTREACH": {
      const targets = ctx.citedOthers.slice(0, 5);
      assets.push(
        asset(
          "targets",
          "Priority outreach targets",
          (targets.length ? targets : ["[CONFIRM: niche association]", "[CONFIRM: industry blog]"])
            .map((d, i) => `${i + 1}. ${d} — cited in GEO answers; pitch a useful resource, not a link beg.`)
            .join("\n"),
        ),
      );
      assets.push(
        asset(
          "pitch",
          "Pitch email",
          `Subject: Resource for your readers (${service})\n\nHi — I'm with ${ctx.brand} (${ctx.domain}).\nWe put together a practical checklist on ${service} for ${audience}.\nHappy to give your audience access / adapt it for your format.\nNo inflated claims — happy to share the source notes.\n\nThanks`,
        ),
      );
      assets.push(asset("followups", "Follow-ups", `Day 3: gentle bump with the checklist angle.\nDay 7: breakup — leave the door open.`));
      break;
    }
    case "REFRESH": {
      assets.push(
        asset(
          "fix-list",
          "Technical / content fix list",
          `Critical: ${ctx.critical} · High: ${ctx.high}\n` +
            ctx.topIssues.map((i) => `- ${i}`).join("\n") +
            `\n\nPage scores:\n${ctx.pageSummaries.map((p) => `- ${p}`).join("\n") || "- n/a"}`,
        ),
      );
      assets.push(
        asset(
          "refresh-copy",
          "Refresh guidance",
          `Update titles/metas on weakest money pages.\nAdd answer-shaped sections for GEO miss prompts.\nRe-internal-link to ${service} page.\nRe-analyze after deploy.`,
        ),
      );
      break;
    }
    case "LOCAL": {
      assets.push(
        asset(
          "local-page",
          "Local landing outline (anti-doorway)",
          `# ${service} in [CONFIRM: city]\nUnique local proof required.\nNAP must match GBP.\nInclude LocalBusiness schema.\nDo NOT spin thin city pages.`,
        ),
      );
      assets.push(asset("gbp", "GBP posts (4)", `1) Offer clarity\n2) Process\n3) Community\n4) FAQ\nBrand: ${ctx.brand}`));
      break;
    }
    case "LINKEDIN": {
      assets.push(
        asset(
          "posts",
          "8 POV posts from evidence",
          [
            `Hook from GEO miss: ${ctx.promptsLost[0] ?? "What buyers ask about " + service}`,
            `SEO reality: readiness ${ctx.seoScore}/100 — what we'll fix first`,
            `Citation landscape: ${ctx.citedOthers.slice(0, 3).join(", ") || "building first-party proof"}`,
            `Who ${service} is for (${audience})`,
            `What we won't claim without proof`,
            `One page on our site worth improving: ${ctx.pageSummaries[0] ?? ctx.url}`,
            `CTA: Position Report / consult`,
            `Lesson from this week's analyze`,
          ]
            .map((l, i) => `${i + 1}. ${l}`)
            .join("\n"),
        ),
      );
      break;
    }
    default: {
      assets.push(
        asset(
          "draft",
          "Working draft",
          `# ${tactic.title}\n\n${tactic.rationale}\n\nFacts:\n${factsBlock}\n\nCTA: Contact ${ctx.brand}`,
        ),
      );
    }
  }

  assets.push(
    asset(
      "measure",
      "Measurement plan",
      `Baseline: SEO ${ctx.seoScore}, GEO ${ctx.geoMentionRate.toFixed(0)}% (n=${ctx.geoSample}).\nImplement → wait 14 days → re-run analyze.\nLeading indicators: form fills / booked calls (not vanity rankings).\nDo not claim causation from a single change.`,
    ),
  );

  return {
    id: `pack-${slug(tactic.id)}`,
    packType: tactic.packType,
    tacticId: tactic.id,
    goal: tactic.title,
    status: "draft",
    assets,
    measurementPlan: assets.find((a) => a.kind === "measure")?.body ?? "",
    effortHours: Math.max(3, assets.length),
    evidenceIds: tactic.evidenceIds,
    createdAt: now,
    siteFactsUsed: ctx.siteFacts.slice(0, 15),
    generation: "deterministic",
  };
}

async function maybeGeminiExpand(
  pack: DeepCampaignPack,
  ctx: SiteContext,
): Promise<DeepCampaignPack> {
  if (!process.env.GEMINI_API_KEY) return pack;
  if (!["SERVICE", "FAQ", "HOME", "ANSWER"].includes(pack.packType)) return pack;

  try {
    const provider = new GeminiVisibilityProvider();
    const draftAsset = pack.assets.find((a) => a.kind === "draft" || a.kind === "faq" || a.kind === "hero");
    if (!draftAsset) return pack;

    const prompt = [
      "Expand this marketing draft for a real business website.",
      "Rules: Use ONLY the site facts. No invented clients, %, awards, guarantees, or #1 claims.",
      "Use [CONFIRM: …] for unknowns. Markdown. Keep CTA.",
      "",
      "SITE FACTS:",
      ...ctx.siteFacts.slice(0, 20),
      "",
      "DRAFT TO EXPAND:",
      draftAsset.body,
    ].join("\n");

    const answer = await provider.answer(prompt, { timeoutMs: 45_000 });
    const body = answer.rawText.trim();
    if (body.length < 200) return pack;

    const expanded = asset(draftAsset.kind, `${draftAsset.title} (Gemini-expanded)`, body, [
      "Expanded via Gemini — human review required",
    ]);
    return {
      ...pack,
      generation: "hybrid",
      assets: pack.assets.map((a) => (a.title === draftAsset.title && a.kind === draftAsset.kind ? expanded : a)),
    };
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) return pack;
    // Keep deterministic pack if Gemini fails
    return {
      ...pack,
      assets: [
        ...pack.assets,
        asset("note", "Gemini expansion skipped", error instanceof Error ? error.message : "Model error", []),
      ],
    };
  }
}

export function buildDeepImprovisation(tactics: MarketingTactic[], ctx: SiteContext): ImprovisationStep[] {
  const steps: ImprovisationStep[] = [];
  const fix = tactics.filter((t) => t.packType === "REFRESH" || t.channel === "site").slice(0, 2);
  for (const t of fix) {
    steps.push({
      id: `fix-${t.id}`,
      bucket: "fix",
      title: t.title,
      detail: t.rationale,
      effortHours: 4,
      tacticId: t.id,
      packType: t.packType,
      evidenceIds: t.evidenceIds,
    });
  }
  for (const t of tactics.filter((t) => ["SERVICE", "FAQ", "HOME", "ANSWER"].includes(t.packType)).slice(0, 3)) {
    steps.push({
      id: `publish-${t.id}`,
      bucket: "publish",
      title: t.title,
      detail: t.rationale,
      effortHours: t.packType === "SERVICE" ? 8 : 4,
      tacticId: t.id,
      packType: t.packType,
      evidenceIds: t.evidenceIds,
    });
  }
  for (const t of tactics.filter((t) => ["OUTREACH", "LINKEDIN", "LOCAL"].includes(t.packType)).slice(0, 3)) {
    steps.push({
      id: `promote-${t.id}`,
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
    id: "measure-rerun",
    bucket: "measure",
    title: "Re-run SEO+GEO analyze in 14 days",
    detail: `Baseline SEO ${ctx.seoScore}, GEO ${ctx.geoMentionRate.toFixed(0)}% (n=${ctx.geoSample}, ${ctx.geoModel})`,
    effortHours: 1,
    evidenceIds: ["ev-measure"],
  });
  return steps;
}

export function buildDeepReport(
  ctx: SiteContext,
  tactics: MarketingTactic[],
  improvisation: ImprovisationStep[],
): PositionReport {
  const pressure = ctx.citedOthers.length > 6 ? "high" : ctx.citedOthers.length > 2 ? "medium" : "low";
  const kpis: MarketingKpi[] = [
    {
      id: "seo",
      label: "SEO readiness",
      value: String(ctx.seoScore),
      hint: `${ctx.pagesScanned} pages · ${ctx.critical} critical`,
    },
    {
      id: "geo",
      label: "GEO mention rate",
      value: `${ctx.geoMentionRate.toFixed(0)}%`,
      hint: `n=${ctx.geoSample} · ${ctx.geoModel}`,
    },
    {
      id: "actions",
      label: "Live next actions",
      value: String(ctx.nextActions.length),
      hint: "From analyze recommendation bus",
    },
    {
      id: "tactics",
      label: "Marketing tactics",
      value: String(tactics.length),
      hint: "Evidence-mapped portfolio",
    },
  ];

  return {
    id: `rpt-${ctx.domain}`,
    brand: ctx.brand,
    domain: ctx.domain,
    generatedAt: new Date().toISOString(),
    mode: "strategist",
    scoreboard: {
      seoReadiness: ctx.seoScore,
      geoMentionRate: ctx.geoMentionRate,
      geoSampleSize: ctx.geoSample,
      competitorPressure: pressure,
      labels: ctx.guardrails,
    },
    chapters: [
      {
        id: "search",
        title: "Search position",
        body: `${ctx.brand} readiness ${ctx.seoScore}/100 across ${ctx.pagesScanned} pages.`,
        bullets: [
          `${ctx.critical} critical · ${ctx.high} high`,
          ...ctx.topIssues.slice(0, 4),
          ...ctx.pageSummaries.slice(0, 3).map((p) => `Observed: ${p}`),
        ],
      },
      {
        id: "geo",
        title: "Answer-engine position",
        body: `Mention rate ${ctx.geoMentionRate.toFixed(0)}% on ${ctx.geoModel} (n=${ctx.geoSample}).`,
        bullets: [
          ctx.geoSample < 5 ? "Sample size low — directional only" : "Sample supports directional decisions",
          ...ctx.promptsWon.slice(0, 3).map((p) => `Win: ${p}`),
          ...ctx.promptsLost.slice(0, 3).map((p) => `Miss: ${p}`),
        ],
      },
      {
        id: "citations",
        title: "Citation landscape",
        body: "Domains appearing in AI answers that are not first-party.",
        bullets: ctx.citedOthers.length
          ? ctx.citedOthers.slice(0, 8)
          : ["No third-party citations observed in this GEO sample"],
      },
      {
        id: "impact",
        title: "What to do next (marketing)",
        body: "Ranked tactics derived from live next-actions + structural gaps.",
        bullets: tactics.slice(0, 6).map((t) => t.title),
      },
    ],
    improvisation,
    tactics,
    kpis,
  };
}

function effortWeight(packType: MarketingTactic["packType"]): number {
  // Mirrors the pack effort defaults: SERVICE pages are the heaviest work.
  if (packType === "SERVICE") return 8;
  if (packType === "HOME" || packType === "COMPARE" || packType === "ENTITY") return 6;
  return 4;
}

function channelMix(hours: number, tactics: MarketingTactic[]): ChannelMix[] {
  const weights: Record<string, number> = {};
  for (const t of tactics.slice(0, 8)) {
    weights[t.channel] = (weights[t.channel] ?? 0) + effortWeight(t.packType);
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(weights)
    .map(([channel, w]) => ({
      channel: channel as ChannelMix["channel"],
      pct: w / total,
      hours: Math.round(hours * (w / total) * 10) / 10,
    }))
    .sort((a, b) => b.hours - a.hours);
}

export async function runDeepMarketingEngine(
  result: AnalyzeResult,
  options: { hoursPerWeek?: number; useGemini?: boolean } = {},
): Promise<DeepMarketingResult> {
  const ctx = extractSiteContext(result);
  const tactics = buildDeepTactics(ctx);
  const improvisation = buildDeepImprovisation(tactics, ctx);
  const report = buildDeepReport(ctx, tactics, improvisation);

  let packs = tactics.slice(0, 8).map((t) => richDeterministicPack(t, ctx));
  if (options.useGemini !== false && process.env.GEMINI_API_KEY) {
    packs = await Promise.all(packs.map((p) => maybeGeminiExpand(p, ctx)));
  }

  const plan: PlanMilestone[] = [
    { window: "30", title: "Fix blockers + ship first converting assets", items: improvisation.filter((s) => s.bucket === "fix" || s.bucket === "publish").slice(0, 4).map((s) => s.title) },
    { window: "60", title: "Distribute + earn citations", items: improvisation.filter((s) => s.bucket === "promote").map((s) => s.title) },
    { window: "90", title: "Measure + compound winners", items: ["Re-analyze SEO+GEO", "Scale winning bandit arms", "Expand vertical pages with proof"] },
  ];

  return {
    context: ctx,
    report,
    tactics,
    improvisation,
    packs,
    channelMix: channelMix(options.hoursPerWeek ?? 8, tactics),
    plan,
  };
}
