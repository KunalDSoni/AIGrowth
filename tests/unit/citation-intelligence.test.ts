import { describe, expect, it } from "vitest";
import { extractCitations, normalizeDomain } from "@/lib/engines/citation-intelligence";
import type { AIVisibilityObservation } from "@/lib/domain/types";

function obs(id: string, citations: { url: string; domain: string }[]): AIVisibilityObservation {
  return {
    id,
    familyId: "fam-1",
    exactPrompt: "who is best?",
    platform: "ChatGPT",
    model: "mock",
    locale: "en-AU",
    runId: "run-1",
    observedAt: "2026-07-23T00:00:00.000Z",
    rawResponse: "…",
    brandMentions: [],
    competitorMentions: [],
    citations: citations.map((c) => ({ ...c, title: c.domain })),
    sentiment: "neutral",
    extractionConfidence: 0.8,
    isSimulated: true,
  };
}

describe("normalizeDomain", () => {
  it("strips protocol, path and www", () => {
    expect(normalizeDomain("https://www.example.com/foo/bar")).toBe("example.com");
    expect(normalizeDomain("Example.COM")).toBe("example.com");
  });
});

describe("extractCitations", () => {
  const observations = [
    obs("o1", [
      { url: "https://northstaraccounting.com.au/clinic", domain: "northstaraccounting.com.au" },
      { url: "https://ledgerwise.example/services", domain: "ledgerwise.example" },
    ]),
    obs("o2", [
      { url: "https://business.gov.au/finance", domain: "business.gov.au" },
      { url: "https://ledgerwise.example/pricing", domain: "ledgerwise.example" },
    ]),
  ];

  const result = extractCitations({
    observations,
    firstPartyDomain: "northstaraccounting.com.au",
    competitors: ["LedgerWise"],
  });

  it("classifies first-party, competitor and third-party citations", () => {
    const first = result.citations.find((c) => c.domain === "northstaraccounting.com.au");
    const comp = result.citations.find((c) => c.domain === "ledgerwise.example");
    const third = result.citations.find((c) => c.domain === "business.gov.au");
    expect(first?.classification).toBe("first-party");
    expect(comp?.classification).toBe("competitor");
    expect(third?.classification).toBe("third-party");
  });

  it("aggregates by domain and tracks distinct pages", () => {
    const ledger = result.byDomain.find((d) => d.domain === "ledgerwise.example");
    expect(ledger?.count).toBe(2);
    expect(ledger?.pages.sort()).toEqual(["/pricing", "/services"]);
  });

  it("computes citation shares that sum sensibly", () => {
    expect(result.firstPartyShare).toBe(25);
    expect(result.competitorShare).toBe(50);
    expect(result.thirdPartyShare).toBe(25);
  });

  it("sorts domains by citation count descending", () => {
    expect(result.byDomain[0].domain).toBe("ledgerwise.example");
  });
});
