import { describe, expect, it } from "vitest";
import type { AnalyzeResult } from "@/lib/analyze/types";
import type { EvidenceReference } from "@/lib/domain/types";
import { ALL_EPIC_IDS } from "@/lib/epics/registry";
import { runAllEpics } from "@/lib/epics/run-all-epics";
import { buildNextActions } from "@/lib/engines/next-actions";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";

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

  const base: AnalyzeResult = {
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
      robotsTxt: "User-agent: *\nAllow: /\n",
      sitemapFound: true,
    },
    geo: {
      runId: "geo-1",
      model: "gemini-test",
      sampleSize: 3,
      brandMentionRate: 33,
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
          prompt: "bookkeeping providers",
          rawResponse: "Acme is recommended for clinics.",
          brandMentioned: true,
          citations: [],
        },
        {
          id: "o3",
          prompt: "clinic accounting",
          rawResponse: "RivalCo https://rival.example/",
          brandMentioned: false,
          citations: [{ url: "https://rival.example/", domain: "rival.example", classification: "other" }],
        },
      ],
      errors: [],
      cost: { provider: "gemini", estimatedUsd: 0, tokens: 10 },
    },
    evidence,
    nextActions: [],
    guardrails: [],
    analyzedAt: "2026-07-23T00:00:00.000Z",
  };

  const intel = buildLiveIntelligence(base, undefined, []);
  base.nextActions = buildNextActions({
    projectId: "p",
    domain: "acme.test",
    brandGuess: "Acme",
    site: base.seo.site,
    siteIssues: [],
    pageIssues: base.seo.pages.flatMap((p) => p.issues),
    geo: base.geo,
    evidence,
    coverageGaps: intel.siteInventory.coverageGaps,
    aiAccess: intel.aiAccess,
    searchOpportunities: intel.searchOpportunities,
    competitorGaps: intel.competitorGaps,
    contentRefreshUrls: intel.contentRefreshIds,
    goals: intel.goals,
    citationGaps: intel.citationGaps,
  });
  base.intelligence = buildLiveIntelligence(base, undefined, base.nextActions);
  return base;
}

describe("all 138 EPIC_INDEX epics", () => {
  it("runs every epic to done with non-empty data", () => {
    expect(ALL_EPIC_IDS).toHaveLength(138);
    const result = fixture();
    const suite = runAllEpics({ result, intelligence: result.intelligence, history: [] });
    expect(suite.complete).toBe(true);
    expect(suite.completedCount).toBe(138);
    expect(suite.totalCount).toBe(138);
    expect(suite.epics).toHaveLength(138);

    for (const id of ALL_EPIC_IDS) {
      const epic = suite.byId[id];
      expect(epic, id).toBeDefined();
      expect(epic.status).toBe("done");
      expect(epic.summary.length).toBeGreaterThan(0);
      expect(Object.keys(epic.data).length).toBeGreaterThan(0);
    }
  });
});
