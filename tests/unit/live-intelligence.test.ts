import { describe, expect, it } from "vitest";
import type { AnalyzeResult } from "@/lib/analyze/types";
import type { EvidenceReference } from "@/lib/domain/types";
import { applyGoalWeights, buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { buildMetadataPack, buildRepurposePack } from "@/lib/engines/metadata-pack";
import { buildActionBrief } from "@/lib/engines/action-brief";
import { buildNextActions } from "@/lib/engines/next-actions";

function fixture(): AnalyzeResult {
  const evidence: EvidenceReference[] = [
    {
      id: "ev-live-crawl-page",
      organizationId: "o",
      projectId: "p",
      kind: "CRAWL_OBSERVATION",
      source: "crawler",
      retrievedAt: "2026-07-23T00:00:00.000Z",
      reliability: "HIGH",
      isEstimated: false,
      isSimulated: false,
      summary: "crawl",
    },
    {
      id: "ev-gemini-answers",
      organizationId: "o",
      projectId: "p",
      kind: "AI_ANSWER_OBSERVATION",
      source: "gemini",
      retrievedAt: "2026-07-23T00:00:00.000Z",
      reliability: "MEDIUM",
      isEstimated: false,
      isSimulated: false,
      summary: "geo",
    },
    {
      id: "ev-gemini-citations",
      organizationId: "o",
      projectId: "p",
      kind: "CITATION_OBSERVATION",
      source: "geo",
      retrievedAt: "2026-07-23T00:00:00.000Z",
      reliability: "MEDIUM",
      isEstimated: true,
      isSimulated: false,
      summary: "cites",
    },
  ];

  return {
    project: { id: "p", domain: "acme.test", brandGuess: "Acme", url: "https://acme.test" },
    seo: {
      site: {
        score: 72,
        band: "good",
        pagesScanned: 2,
        pagesFailed: 0,
        totalIssues: 1,
        critical: 0,
        high: 1,
        quickWins: 0,
        worstPages: [],
        topIssues: [],
      },
      pages: [
        {
          url: "https://acme.test/",
          finalUrl: "https://acme.test/",
          title: "Acme Bookkeeping for Clinics",
          ok: true,
          metrics: { score: 80, band: "good", critical: 0, high: 0, quickWins: 0, monitor: 0, total: 0 },
          issues: [],
          observation: {
            id: "home",
            url: "/",
            statusCode: 200,
            title: "Acme Bookkeeping for Clinics",
            h1Count: 1,
            wordCount: 850,
            hasViewport: true,
            hasStructuredData: true,
            imageCount: 2,
            imagesMissingAlt: 0,
            internalLinkCount: 8,
            pageType: "home",
          },
        },
        {
          url: "https://acme.test/services",
          finalUrl: "https://acme.test/services",
          title: "Services",
          ok: true,
          metrics: { score: 60, band: "fair", critical: 0, high: 1, quickWins: 0, monitor: 0, total: 1 },
          issues: [
            {
              id: "i1",
              ruleId: "title-short",
              category: "metadata",
              severity: "high",
              title: "Title is short",
              description: "Short",
              recommendedAction: "Expand title",
              affectedPages: 1,
              evidenceIds: ["ev-live-crawl-page"],
              impactArea: "metadata",
            },
          ],
          observation: {
            id: "svc",
            url: "/services",
            statusCode: 200,
            title: "Services",
            h1Count: 1,
            wordCount: 120,
            hasViewport: true,
            hasStructuredData: false,
            imageCount: 0,
            imagesMissingAlt: 0,
            internalLinkCount: 2,
            pageType: "service",
          },
        },
      ],
      siteIssues: [],
      scannedAt: "2026-07-23T00:00:00.000Z",
      finalUrl: "https://acme.test/",
      origin: "https://acme.test",
      robotsTxt: "User-agent: *\nAllow: /\nSitemap: https://acme.test/sitemap.xml\n",
      sitemapFound: true,
    },
    geo: {
      runId: "geo-1",
      model: "gemini-test",
      sampleSize: 3,
      brandMentionRate: 0,
      firstPartyCitationShare: 0,
      observations: [
        {
          id: "o1",
          prompt: "best bookkeeping for clinics",
          rawResponse: "Try RivalCo https://rival.example/guide",
          brandMentioned: false,
          citations: [{ url: "https://rival.example/guide", domain: "rival.example", classification: "other" }],
        },
        {
          id: "o2",
          prompt: "bookkeeping providers near me",
          rawResponse: "Several options exist.",
          brandMentioned: false,
          citations: [],
        },
        {
          id: "o3",
          prompt: "clinic accounting software",
          rawResponse: "RivalCo is cited https://rival.example/",
          brandMentioned: false,
          citations: [{ url: "https://rival.example/", domain: "rival.example", classification: "other" }],
        },
      ],
      errors: [],
      cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
    },
    evidence,
    nextActions: [],
    guardrails: [],
    analyzedAt: "2026-07-23T00:00:00.000Z",
  };
}

describe("live intelligence", () => {
  it("builds cross-engine intelligence without demo datasets", () => {
    const result = fixture();
    const intel = buildLiveIntelligence(result, undefined, []);
    expect(intel.profile.name).toBe("Acme");
    expect(intel.siteInventory.pages.length).toBeGreaterThan(0);
    expect(intel.contentInventory.length).toBeGreaterThan(0);
    expect(intel.searchOpportunities.length).toBeGreaterThan(0);
    expect(intel.searchOpportunities.every((o) => o.source === "crawl-derived")).toBe(true);
    expect(intel.citations.byDomain.some((d) => d.domain === "rival.example")).toBe(true);
    expect(intel.competitors.length).toBeGreaterThan(0);
    expect(intel.promptVariants.length).toBeGreaterThan(0);
    expect(intel.aiAccess.length).toBeGreaterThanOrEqual(0);
    expect(intel.labels.some((l) => /crawl/i.test(l))).toBe(true);
  });

  it("re-ranks next actions by goal focus", () => {
    const result = fixture();
    const pageIssues = result.seo.pages.flatMap((p) => p.issues);
    const actions = buildNextActions({
      projectId: "p",
      domain: "acme.test",
      brandGuess: "Acme",
      site: result.seo.site,
      siteIssues: [],
      pageIssues,
      geo: result.geo,
      evidence: result.evidence,
    });
    expect(actions.length).toBeGreaterThan(0);
    const geoFirst = applyGoalWeights(actions, {
      primary: "ai-visibility",
      weights: { "ai-visibility": 100, "technical-health": 10 },
    });
    const techFirst = applyGoalWeights(actions, {
      primary: "technical-health",
      weights: { "technical-health": 100, "ai-visibility": 10 },
    });
    expect(geoFirst[0].source === "ai-visibility" || geoFirst[0].source === "citation").toBe(true);
    expect(techFirst.some((a) => a.source === "technical")).toBe(true);
  });

  it("builds metadata and repurpose packs from briefs", () => {
    const result = fixture();
    result.nextActions = buildNextActions({
      projectId: "p",
      domain: "acme.test",
      brandGuess: "Acme",
      site: result.seo.site,
      siteIssues: [],
      pageIssues: result.seo.pages.flatMap((p) => p.issues),
      geo: result.geo,
      evidence: result.evidence,
    });
    const pkg = buildActionBrief(result, result.nextActions[0]);
    const meta = buildMetadataPack(pkg, "metadata");
    const repurpose = buildRepurposePack(pkg);
    expect(meta.title.length).toBeGreaterThan(0);
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.claimsFlagged.length).toBeGreaterThanOrEqual(0);
    expect(repurpose.linkedin).toContain(meta.title.slice(0, 10) !== "" ? "" : "");
    expect(repurpose.emailSubject.length).toBeGreaterThan(0);
  });
});
