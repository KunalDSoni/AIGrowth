import { describe, expect, it } from "vitest";
import { buildSiteInventory } from "@/lib/engines/site-inventory";
import type { BusinessProfileSnapshot, TechnicalPageObservation } from "@/lib/domain/types";

function obs(url: string, wordCount = 500): TechnicalPageObservation {
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
    internalLinkCount: 3,
    pageType: "service",
  };
}

const business: BusinessProfileSnapshot = {
  id: "acme",
  name: "Acme",
  market: "Australia",
  industry: "Accounting",
  goal: "Leads",
  audienceSegments: ["Clinics"],
  services: ["Bookkeeping", "Virtual CFO"],
  differentiators: [],
  tone: "Warm",
};

describe("buildSiteInventory", () => {
  it("classifies pages by purpose with confidence and signals", () => {
    const inv = buildSiteInventory({
      pages: [
        obs("/"),
        obs("/bookkeeping"),
        obs("/blog/tax-guide", 1200),
        obs("/xero-vs-myob"),
        obs("/sydney"),
        obs("/privacy"),
        obs("/faq"),
      ],
    });
    const byUrl = Object.fromEntries(inv.pages.map((p) => [p.url, p.purpose]));
    expect(byUrl["/"]).toBe("homepage");
    expect(byUrl["/bookkeeping"]).toBe("service");
    expect(byUrl["/blog/tax-guide"]).toBe("article");
    expect(byUrl["/xero-vs-myob"]).toBe("comparison");
    expect(byUrl["/sydney"]).toBe("location");
    expect(byUrl["/privacy"]).toBe("legal");
    expect(byUrl["/faq"]).toBe("faq");
    expect(inv.pages.every((p) => p.confidence > 0 && p.signals.length > 0)).toBe(true);
  });

  it("counts purposes", () => {
    const inv = buildSiteInventory({ pages: [obs("/"), obs("/bookkeeping"), obs("/payroll")] });
    expect(inv.countsByPurpose.homepage).toBe(1);
    expect(inv.countsByPurpose.service).toBe(2);
  });

  it("honours manual overrides at full confidence", () => {
    const inv = buildSiteInventory({ pages: [obs("/mystery")], overrides: { "/mystery": "industry" } });
    expect(inv.pages[0].purpose).toBe("industry");
    expect(inv.pages[0].confidence).toBe(100);
    expect(inv.pages[0].overridden).toBe(true);
  });

  it("detects service coverage gaps against the business profile", () => {
    const inv = buildSiteInventory({ pages: [obs("/"), obs("/bookkeeping")], business });
    expect(inv.coverageGaps.some((g) => g.service === "Virtual CFO")).toBe(true);
    expect(inv.coverageGaps.some((g) => g.service === "Bookkeeping")).toBe(false);
  });
});
