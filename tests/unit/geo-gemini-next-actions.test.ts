import { describe, it, expect, vi } from "vitest";
import { GeminiNotConfiguredError, GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";
import { runGeoProbes } from "@/lib/engines/run-geo";
import { buildNextActions } from "@/lib/engines/next-actions";
import type { EvidenceReference } from "@/lib/domain/types";
import type { SiteSummary } from "@/lib/engines/site-audit";

describe("GeminiVisibilityProvider", () => {
  it("throws when key missing", () => {
    const prev = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(() => new GeminiVisibilityProvider({ apiKey: "" })).toThrow(GeminiNotConfiguredError);
    if (prev) process.env.GEMINI_API_KEY = prev;
  });

  it("calls Gemini generateContent with mocked fetch", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Dosacc is mentioned here https://dosacc.com/" }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const provider = new GeminiVisibilityProvider({ apiKey: "test-key", model: "gemini-2.0-flash", fetchImpl: fetchImpl as unknown as typeof fetch });
    const answer = await provider.answer("Who is Dosacc?");
    expect(answer.rawText).toContain("Dosacc");
    expect(fetchImpl).toHaveBeenCalled();
    const calledUrl = String(fetchImpl.mock.calls.at(0)?.at(0) ?? "");
    expect(calledUrl).toContain("gemini-2.0-flash");
    expect(calledUrl).toContain("key=test-key");
  });
});

describe("runGeoProbes", () => {
  it("runs capped prompts via provider", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "No brand here https://other.example/" }] } }],
        }),
        { status: 200 },
      ),
    );
    const provider = new GeminiVisibilityProvider({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    const geo = await runGeoProbes({
      brandGuess: "Dosacc",
      domain: "dosacc.com",
      services: ["bookkeeping"],
      provider,
      maxPrompts: 5,
    });
    expect(geo.sampleSize).toBe(5);
    expect(geo.brandMentionRate).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });
});

describe("buildNextActions", () => {
  it("ranks SEO and GEO candidates with evidence", () => {
    const site: SiteSummary = {
      score: 70,
      band: "good",
      pagesScanned: 3,
      pagesFailed: 0,
      totalIssues: 1,
      critical: 1,
      high: 0,
      quickWins: 0,
      monitors: 0,
      worstPages: [],
      topIssues: [],
    };
    const evidence: EvidenceReference[] = [
      {
        id: "ev-live-crawl-page",
        organizationId: "o",
        projectId: "p",
        kind: "CRAWL_OBSERVATION",
        source: "crawler",
        retrievedAt: "2026-07-23",
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
        retrievedAt: "2026-07-23",
        reliability: "MEDIUM",
        isEstimated: false,
        isSimulated: false,
        summary: "answers",
      },
      {
        id: "ev-gemini-citations",
        organizationId: "o",
        projectId: "p",
        kind: "CITATION_OBSERVATION",
        source: "extract",
        retrievedAt: "2026-07-23",
        reliability: "MEDIUM",
        isEstimated: true,
        isSimulated: false,
        summary: "cites",
      },
    ];
    const ranked = buildNextActions({
      projectId: "p",
      domain: "dosacc.com",
      brandGuess: "Dosacc",
      site,
      siteIssues: [
        {
          id: "i1",
          ruleId: "title-missing",
          category: "metadata",
          severity: "critical",
          title: "Page has no title",
          description: "missing",
          recommendedAction: "Add a title",
          affectedPages: 1,
          evidenceIds: ["ev-live-crawl-page"],
          impactArea: "metadata",
        },
      ],
      pageIssues: [],
      geo: {
        runId: "g",
        model: "gemini-2.0-flash",
        sampleSize: 5,
        brandMentionRate: 0,
        firstPartyCitationShare: 0,
        observations: [],
        errors: [],
        cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
      },
      evidence,
    });
    expect(ranked.some((c) => c.source === "technical")).toBe(true);
    expect(ranked.some((c) => c.source === "ai-visibility" || c.source === "citation")).toBe(true);
    expect(ranked.every((c) => c.evidenceIds.length > 0)).toBe(true);
  });
});
