import { describe, expect, it } from "vitest";
import { assembleSpineFrom } from "@/lib/reports/spine";
import { buildMarketingReport } from "@/lib/reports/builders/marketing";
import type { MarketingWorkspace } from "@/lib/marketing/workspace";

function ws(withReport: boolean): MarketingWorkspace | null {
  if (!withReport) return null;
  return {
    domain: "acme.com", brand: "Acme", source: "live", updatedAt: "",
    report: {
      id: "r", brand: "Acme", domain: "acme.com", generatedAt: "", mode: "client",
      scoreboard: { seoReadiness: 72, geoMentionRate: 0.4, geoSampleSize: 20, competitorPressure: "medium", labels: [] },
      chapters: [{ id: "c1", title: "Where you stand", body: "Solid technically.", bullets: ["Good speed"] }],
      improvisation: [{ id: "s1", bucket: "Fix", title: "Add titles", detail: "3 pages", effortHours: 2 }],
      tactics: [],
      kpis: [{ id: "k1", label: "Readiness", value: "72" }],
    },
  } as unknown as MarketingWorkspace;
}

describe("buildMarketingReport", () => {
  it("renders KPIs, chapters and the Fix/Publish/Promote/Measure plan", () => {
    const model = buildMarketingReport(assembleSpineFrom("acme.com", null, ws(true)));
    expect(model.slug).toBe("marketing");
    expect(model.status).toBe("ready");
    const kinds = model.sections.flatMap((s) => s.blocks.map((b) => b.kind));
    expect(kinds).toContain("kpis");
    expect(kinds).toContain("chapter");
    expect(kinds).toContain("table");
  });

  it("is insufficient with no workspace", () => {
    const model = buildMarketingReport(assembleSpineFrom("acme.com", null, ws(false)));
    expect(model.status).toBe("not_run");
    const kinds = model.sections.flatMap((s) => s.blocks.map((b) => b.kind));
    expect(kinds).toEqual(["insufficient"]);
  });
});
