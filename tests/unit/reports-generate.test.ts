import { describe, expect, it } from "vitest";
import { generateReportDocument } from "@/lib/reports/generate";
import type { ReportModel } from "@/lib/reports/types";

const model: ReportModel = {
  slug: "seo", title: "SEO Report", domain: "acme.com", brand: "Acme", generatedAt: "2026-07-24T00:00:00Z", status: "ready",
  sections: [{ id: "s", title: "Audit", blocks: [{ kind: "insufficient", reason: "n/a" }] }],
};

describe("generateReportDocument", () => {
  it("stores an HTML artifact and returns a served url when PDF is disabled", async () => {
    const out = await generateReportDocument(model, { preferPdf: false });
    expect(out.format).toBe("html");
    expect(out.url).toMatch(/^\/api\/reports\//);
    expect(out.stored.contentType).toContain("text/html");
  });
});
