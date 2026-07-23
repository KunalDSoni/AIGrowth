import { describe, expect, it } from "vitest";
import {
  buildContentInventory,
  detectRefreshCandidates,
  type ContentInventoryInput,
} from "@/lib/engines/content-inventory";
import type { TechnicalPageObservation } from "@/lib/domain/types";

const NOW = new Date("2026-07-23T00:00:00.000Z");

function obs(url: string, wordCount: number, internalLinkCount = 3): TechnicalPageObservation {
  return {
    id: `t-${url}`,
    url,
    statusCode: 200,
    h1Count: 1,
    wordCount,
    hasViewport: true,
    hasStructuredData: false,
    imageCount: 1,
    imagesMissingAlt: 0,
    internalLinkCount,
    pageType: "service",
  };
}

function input(over: Partial<ContentInventoryInput> & { observation: TechnicalPageObservation; targetQuery: string }): ContentInventoryInput {
  return { purpose: "service", lastUpdated: "2026-06-01T00:00:00.000Z", ...over };
}

describe("buildContentInventory", () => {
  it("labels performance source and computes an SEO value", () => {
    const inv = buildContentInventory([input({ observation: obs("/bookkeeping", 600), targetQuery: "bookkeeping" })], NOW);
    expect(inv[0].performanceSource).toBe("simulated");
    expect(inv[0].seoValue).toBeGreaterThan(0);
    expect(inv[0].impressions).toBeGreaterThan(0);
  });

  it("flags thin content", () => {
    const inv = buildContentInventory([input({ observation: obs("/thin", 120), targetQuery: "thin" })], NOW);
    expect(inv[0].status).toBe("thin");
  });

  it("flags stale content", () => {
    const inv = buildContentInventory(
      [input({ observation: obs("/old", 800), targetQuery: "old", lastUpdated: "2024-01-01T00:00:00.000Z" })],
      NOW,
    );
    expect(inv[0].status).toBe("stale");
  });

  it("marks duplicate coverage when two pages target the same query", () => {
    const inv = buildContentInventory(
      [
        input({ observation: obs("/a", 900, 8), targetQuery: "clinic bookkeeping" }),
        input({ observation: obs("/b", 500, 1), targetQuery: "clinic bookkeeping" }),
      ],
      NOW,
    );
    const statuses = inv.map((i) => i.status);
    expect(statuses.filter((s) => s === "duplicate").length).toBe(1);
  });

  it("respects real metrics when provided", () => {
    const inv = buildContentInventory(
      [input({ observation: obs("/x", 800), targetQuery: "x", metrics: { impressions: 10, clicks: 1, position: 3, source: "search-console" } })],
      NOW,
    );
    expect(inv[0].performanceSource).toBe("search-console");
    expect(inv[0].impressions).toBe(10);
  });
});

describe("detectRefreshCandidates", () => {
  it("emits reasons for thin, proofless, CTA-less pages and prioritizes them", () => {
    const inv = buildContentInventory(
      [input({ observation: obs("/weak", 150), targetQuery: "weak", hasProof: false, hasClearCta: false })],
      NOW,
    );
    const candidates = detectRefreshCandidates(inv, NOW);
    expect(candidates.length).toBe(1);
    expect(candidates[0].reasons.length).toBeGreaterThanOrEqual(3);
    expect(candidates[0].priority).toBeGreaterThan(0);
  });

  it("produces no candidate for a healthy, proven, CTA-clear page", () => {
    const inv = buildContentInventory(
      [input({ observation: obs("/great", 900, 8), targetQuery: "great", hasProof: true, hasClearCta: true })],
      NOW,
    );
    expect(detectRefreshCandidates(inv, NOW)).toEqual([]);
  });

  it("ranks higher-value pages first", () => {
    const inv = buildContentInventory(
      [
        input({ observation: obs("/low", 150, 1), targetQuery: "low", hasProof: false, hasClearCta: false }),
        input({ observation: obs("/high", 200, 9), targetQuery: "high", hasProof: false, hasClearCta: false }),
      ],
      NOW,
    );
    const candidates = detectRefreshCandidates(inv, NOW);
    expect(candidates[0].priority).toBeGreaterThanOrEqual(candidates[1].priority);
  });
});
