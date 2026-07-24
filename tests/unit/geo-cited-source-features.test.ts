import { describe, expect, it } from "vitest";
import { buildCitedSourceProfiles, extractAnswerFitness, type CitedSourceCrawler } from "@/lib/engines/geo-cited-source-features";
import type { CitationLedger, PromptCitationRecord } from "@/lib/analyze/types";

const FIXED_NOW = new Date("2026-07-24T00:00:00Z");

describe("extractAnswerFitness", () => {
  it("detects a definitional answer-first lead", () => {
    const html = "<p>Payroll outsourcing is a service where a provider runs payroll for you.</p>";
    expect(extractAnswerFitness(html, FIXED_NOW).hasDirectAnswer).toBe(true);
  });

  it("detects FAQ structure from FAQPage json-ld", () => {
    const html = `<script type="application/ld+json">{"@type":"FAQPage"}</script>`;
    expect(extractAnswerFitness(html, FIXED_NOW).hasFaqStructure).toBe(true);
  });

  it("detects FAQ structure from two question headings", () => {
    const html = "<h2>What is it?</h2><p>x</p><h2>How much does it cost?</h2><p>y</p>";
    expect(extractAnswerFitness(html, FIXED_NOW).hasFaqStructure).toBe(true);
  });

  it("detects comparison content from text and from a table", () => {
    expect(extractAnswerFitness("<p>Acme vs Globex compared</p>", FIXED_NOW).hasComparisonContent).toBe(true);
    expect(
      extractAnswerFitness("<table><tr><th>Features</th><th>Us</th></tr></table>", FIXED_NOW).hasComparisonContent,
    ).toBe(true);
  });

  it("detects structured pricing from a price and from Offer json-ld", () => {
    expect(extractAnswerFitness("<p>Plans from $49/mo</p>", FIXED_NOW).hasStructuredPricing).toBe(true);
    expect(
      extractAnswerFitness(`<script type="application/ld+json">{"@type":"Offer"}</script>`, FIXED_NOW)
        .hasStructuredPricing,
    ).toBe(true);
  });

  it("detects freshness from dateModified, from 'updated', and from the current year", () => {
    expect(extractAnswerFitness(`<script>{"dateModified":"2020-01-01"}</script>`, FIXED_NOW).hasFreshnessSignal).toBe(true);
    expect(extractAnswerFitness("<p>Last updated recently</p>", FIXED_NOW).hasFreshnessSignal).toBe(true);
    expect(extractAnswerFitness("<p>Guide for 2026</p>", FIXED_NOW).hasFreshnessSignal).toBe(true);
  });

  it("does not treat an old year alone as fresh", () => {
    expect(extractAnswerFitness("<p>Written in 2011.</p>", FIXED_NOW).hasFreshnessSignal).toBe(false);
  });

  it("detects structured data and proof signals", () => {
    const f = extractAnswerFitness(
      `<script type="application/ld+json">{"@type":"Organization"}</script><p>Trusted by 200 clients</p>`,
      FIXED_NOW,
    );
    expect(f.hasStructuredData).toBe(true);
    expect(f.hasProofSignal).toBe(true);
  });

  it("counts visible words and strips scripts/styles/tags", () => {
    const html = "<style>.a{color:red}</style><script>var x=1</script><p>one two three</p>";
    expect(extractAnswerFitness(html, FIXED_NOW).wordCount).toBe(3);
  });

  it("returns all-false and zero words for an empty page", () => {
    const f = extractAnswerFitness("", FIXED_NOW);
    expect(f).toEqual({
      hasDirectAnswer: false,
      hasFaqStructure: false,
      hasComparisonContent: false,
      hasStructuredPricing: false,
      hasFreshnessSignal: false,
      hasStructuredData: false,
      hasProofSignal: false,
      wordCount: 0,
    });
  });
});

function record(promptId: string, others: string[]): PromptCitationRecord {
  return {
    promptId,
    prompt: promptId,
    status: "absent",
    brandMentioned: false,
    brandCited: false,
    competitorDomains: others,
    citedSources: others.map((d) => ({ url: `https://${d}/page`, domain: d, classification: "other" as const })),
  };
}

function ledgerOf(records: PromptCitationRecord[]): CitationLedger {
  const freq = new Map<string, number>();
  for (const r of records) for (const d of r.competitorDomains) freq.set(d, (freq.get(d) ?? 0) + 1);
  return {
    runId: "run-1",
    model: "fake",
    sampleSize: records.length,
    records,
    competitorFrequency: [...freq.entries()]
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain)),
    coverage: { cited: 0, mentionedNotCited: 0, absent: records.length, unanswered: 0 },
    reliable: true,
    evidenceIds: [],
  };
}

function fakeCrawler(fn: (url: string) => { rawHtml?: string; finalUrl?: string; statusCode?: number } | Error): CitedSourceCrawler {
  return {
    async crawl(url: string) {
      const out = fn(url);
      if (out instanceof Error) throw out;
      return { rawHtml: out.rawHtml, finalUrl: out.finalUrl ?? url, statusCode: out.statusCode ?? 200 };
    },
  };
}

describe("buildCitedSourceProfiles", () => {
  it("profiles the top-limit domains by citation frequency", async () => {
    const ledger = ledgerOf([record("p1", ["a.com", "b.com"]), record("p2", ["a.com"]), record("p3", ["c.com"])]);
    const profiles = await buildCitedSourceProfiles(ledger, {
      crawler: fakeCrawler(() => ({ rawHtml: "<p>Acme is a service. Plans from $9/mo</p>" })),
      limit: 2,
    });
    expect(profiles).toHaveLength(2);
    expect(profiles[0].domain).toBe("a.com");
    expect(profiles[0].citationCount).toBe(2);
    expect(profiles[0].citedForPrompts.sort()).toEqual(["p1", "p2"]);
    expect(profiles[0].crawlStatus).toBe("extracted");
    expect(profiles[0].features?.hasStructuredPricing).toBe(true);
  });

  it("marks a throwing crawl unreachable without throwing", async () => {
    const ledger = ledgerOf([record("p1", ["a.com"])]);
    const profiles = await buildCitedSourceProfiles(ledger, {
      crawler: fakeCrawler(() => new Error("blocked")),
    });
    expect(profiles[0].crawlStatus).toBe("unreachable");
    expect(profiles[0].note).toBeTruthy();
    expect(profiles[0].features).toBeUndefined();
  });

  it("marks a non-2xx or empty-body crawl unreachable", async () => {
    const ledger = ledgerOf([record("p1", ["a.com"])]);
    const profiles = await buildCitedSourceProfiles(ledger, {
      crawler: fakeCrawler(() => ({ statusCode: 404 })),
    });
    expect(profiles[0].crawlStatus).toBe("unreachable");
  });

  it("returns [] when no competitor domains were cited", async () => {
    const ledger = ledgerOf([record("p1", [])]);
    const profiles = await buildCitedSourceProfiles(ledger, { crawler: fakeCrawler(() => ({ rawHtml: "x" })) });
    expect(profiles).toEqual([]);
  });

  it("does not mutate the input ledger", async () => {
    const ledger = ledgerOf([record("p1", ["a.com"])]);
    const snapshot = JSON.stringify(ledger);
    await buildCitedSourceProfiles(ledger, { crawler: fakeCrawler(() => ({ rawHtml: "x" })) });
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });
});
