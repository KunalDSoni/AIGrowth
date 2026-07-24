import { describe, expect, it } from "vitest";
import { renderReportHtml } from "@/lib/reports/render-html";
import type { ReportModel } from "@/lib/reports/types";

const seo: ReportModel = {
  slug: "seo", title: "SEO Report", domain: "acme.com", brand: "Acme", generatedAt: "2026-07-24T00:00:00Z", status: "ready",
  sections: [{ id: "s", title: "Audit", blocks: [
    { kind: "kpis", items: [{ label: "Readiness", value: "72" }] },
    { kind: "table", title: "Issues", columns: ["A"], rows: [["<b>x</b>"]] },
    { kind: "insufficient", reason: "thin data" },
  ] }],
};
const geo: ReportModel = { ...seo, slug: "geo", title: "GEO Report" };

describe("renderReportHtml", () => {
  it("renders a single report as a full HTML document with the brand + title", () => {
    const html = renderReportHtml(seo);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("SEO Report");
    expect(html).toContain("Acme");
    expect(html).toContain("thin data");
  });

  it("escapes interpolated cell content", () => {
    const html = renderReportHtml(seo);
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });

  it("renders a combined bundle with a Full Position Report cover and page breaks", () => {
    const html = renderReportHtml([seo, geo]);
    expect(html).toContain("Full Position Report");
    expect(html).toContain("SEO Report");
    expect(html).toContain("GEO Report");
    expect(html).toContain("page-break-before");
  });
});
