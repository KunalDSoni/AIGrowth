import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIngestionReport } from "@/lib/engines/ingestion-report";

describe("buildIngestionReport (OSI-003 / MDM-003 surfacing)", () => {
  beforeEach(() => {
    process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "ingestion-report-"));
  });

  it("composes every section with honest provenance labels (mock defaults)", async () => {
    const report = await buildIngestionReport("example.com", { env: {} });

    expect(report.domain).toBe("example.com");
    expect(report.crawl.data.pagesScanned).toBeGreaterThan(0);
    expect(report.crawl.data.indexedDocs).toBe(report.crawl.data.pagesScanned);

    // Mock adapters must never masquerade as measured.
    expect(report.crawl.measurement).toBe("simulated");
    expect(report.geo.measurement).toBe("simulated");
    expect(report.performance.measurement).toBe("simulated");
    expect(report.authority.measurement).toBe("estimate");

    // Audit ran across the crawled pages.
    expect(report.audit.data.issueCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(report.audit.data.topIssues)).toBe(true);

    // GEO probed the mock answer engine.
    expect(report.geo.data.sampleSize).toBe(3);

    // Parity is skipped offline with an explicit reason.
    expect("skipped" in report.parity && report.parity.skipped).toBe(true);

    // SERP + retrieval present.
    expect(report.serp.data.results.length).toBeGreaterThan(0);
    expect(["sufficient", "directional", "insufficient"]).toContain(report.retrieval.verdict);
    expect(report.guardrails.length).toBeGreaterThan(0);
  });
});
