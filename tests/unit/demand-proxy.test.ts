import { describe, expect, it } from "vitest";
import { buildDemandProxy } from "@/lib/engines/demand-proxy";
import type { DemandSignal } from "@/lib/providers/search";
import type { BusinessProfileSnapshot } from "@/lib/domain/types";

const business: BusinessProfileSnapshot = {
  id: "acme",
  name: "Acme",
  market: "Australia",
  industry: "Accounting",
  goal: "Leads",
  audienceSegments: ["Clinics"],
  services: ["Bookkeeping"],
  differentiators: [],
  tone: "Warm",
};

function signal(over: Partial<DemandSignal> & Pick<DemandSignal, "query" | "service">): DemandSignal {
  return { topic: "topic", source: "demo", isEstimated: true, monthlySearches: 400, competitionIndex: 50, ...over };
}

describe("buildDemandProxy", () => {
  it("classifies intent and funnel per opportunity", () => {
    const opps = buildDemandProxy({
      signals: [signal({ query: "bookkeeping vs in-house", service: "Bookkeeping" })],
      business,
    });
    expect(opps[0].intent).toBe("comparison");
    expect(opps[0].funnelStage).toBe("decision");
  });

  it("ranks higher-relevance, higher-volume, lower-competition first", () => {
    const opps = buildDemandProxy({
      signals: [
        signal({ query: "obscure niche thing", service: "Unrelated", monthlySearches: 60, competitionIndex: 90 }),
        signal({ query: "bookkeeping for clinics", service: "Bookkeeping", monthlySearches: 900, competitionIndex: 20 }),
      ],
      business,
    });
    expect(opps[0].service).toBe("Bookkeeping");
    expect(opps[0].demandProxy).toBeGreaterThan(opps[1].demandProxy);
  });

  it("carries source and estimate labels", () => {
    const opps = buildDemandProxy({ signals: [signal({ query: "bookkeeping services", service: "Bookkeeping" })], business });
    expect(opps[0].labels).toContain("Demo data");
    expect(opps[0].labels).toContain("Estimated");
    expect(opps[0].isEstimated).toBe(true);
  });

  it("gives declared services higher business relevance than undeclared", () => {
    const declared = buildDemandProxy({ signals: [signal({ query: "x", service: "Bookkeeping" })], business })[0];
    const undeclared = buildDemandProxy({ signals: [signal({ query: "x", service: "Marketing" })], business })[0];
    expect(declared.businessRelevance).toBeGreaterThan(undeclared.businessRelevance);
  });
});
