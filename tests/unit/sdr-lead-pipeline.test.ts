import { describe, expect, it, vi } from "vitest";
import { DemoProspectSource, enrichProspect, runSdrLeadPipeline } from "@/lib/engines/sdr-lead-pipeline";
import { estimateMonthlyRevenueAtRisk, renderAuditReportHtml } from "@/lib/engines/audit-report";
import { FileObjectStore } from "@/lib/storage/object-store";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("SDR lead pipeline", () => {
  it("returns NAP demo prospects for a niche/geo", async () => {
    const seeds = await new DemoProspectSource().find({ niche: "Dentist", geo: "Ahmedabad", limit: 2 });
    expect(seeds).toHaveLength(2);
    expect(seeds[0].name).toContain("Dentist");
    expect(seeds[0].address).toContain("Ahmedabad");
    expect(seeds[0].phone).toBeTruthy();
    expect(seeds[0].source).toBe("demo");
  });

  it("enriches a prospect with crawl flags using injected fetch", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        `<!doctype html><html><head><title>Clinic</title><meta name="viewport" content="width=device-width"></head>
        <body><h1>Clinic</h1><p>Short.</p></body></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    );
    const lead = await enrichProspect(
      {
        name: "Test Clinic",
        website: "https://clinic.example/",
        source: "demo",
        niche: "Dentist",
        geo: "Ahmedabad",
      },
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        dnsLookup: async () => [{ address: "93.184.216.34" }],
      },
    );
    expect(lead.hasLocalBusinessSchema).toBe(false);
    expect(lead.flags.some((f) => f.code === "missing-local-schema")).toBe(true);
    expect(lead.flags.some((f) => f.code === "thin-content")).toBe(true);
  });

  it("runs the pipeline with mocked crawler options", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        `<html><head><title>Ok</title><script type="application/ld+json">{"@type":"Dentist"}</script></head>
        <body><h1>Ok</h1><p>${"word ".repeat(300)}</p><a href="/book">Book</a></body></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    );
    const { leads, simulated } = await runSdrLeadPipeline({
      niche: "Dentist",
      geo: "Ahmedabad",
      limit: 1,
      crawlerOptions: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        dnsLookup: async () => [{ address: "93.184.216.34" }],
      },
    });
    expect(simulated).toBe(true);
    expect(leads[0].hasLocalBusinessSchema).toBe(true);
  });
});

describe("audit report", () => {
  it("renders HTML with NAP and directional risk", () => {
    const html = renderAuditReportHtml({
      lead: {
        nap: { name: "City Dentist", address: "Ahmedabad", phone: "123" },
        website: "https://example.com",
        source: "demo",
        niche: "Dentist",
        geo: "Ahmedabad",
        readinessScore: 55,
        flags: [{ code: "missing-local-schema", severity: "high", detail: "No schema" }],
        hasLocalBusinessSchema: false,
        enrichedAt: "2026-07-23T00:00:00.000Z",
      },
    });
    expect(html).toContain("City Dentist");
    expect(html).toContain("missing-local-schema");
    expect(estimateMonthlyRevenueAtRisk({ readinessScore: 55 } as never)).toBe(3600);
  });

  it("stores HTML reports via FileObjectStore", async () => {
    const dir = await mkdtemp(join(tmpdir(), "og-reports-"));
    try {
      const store = new FileObjectStore(dir);
      const stored = await store.put({ body: "<html>ok</html>", contentType: "text/html" });
      const loaded = await store.get(stored.id);
      expect(loaded?.body.toString("utf8")).toContain("ok");
      expect(stored.url).toContain("/api/reports/");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
