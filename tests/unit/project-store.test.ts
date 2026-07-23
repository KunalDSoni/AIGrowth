import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { domainKey, createFileProjectStore } from "@/lib/projects/store";
import type { AnalyzeResult } from "@/lib/analyze/types";

describe("domainKey", () => {
  it("normalizes host", () => {
    expect(domainKey("https://www.Dosacc.com/path")).toBe("dosacc.com");
  });
});

describe("file project store", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "og-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("saves and loads latest by domain", async () => {
    const store = createFileProjectStore(dir);
    const result = {
      project: { id: "p1", domain: "dosacc.com", brandGuess: "Dosacc", url: "https://dosacc.com/" },
      seo: {
        site: {
          score: 90,
          band: "excellent",
          pagesScanned: 1,
          pagesFailed: 0,
          totalIssues: 0,
          critical: 0,
          high: 0,
          quickWins: 0,
          worstPages: [],
          topIssues: [],
        },
        pages: [],
        siteIssues: [],
        scannedAt: "2026-07-23T00:00:00.000Z",
        finalUrl: "https://dosacc.com/",
        origin: "https://dosacc.com",
      },
      geo: {
        runId: "g1",
        model: "gemini-2.0-flash",
        sampleSize: 0,
        brandMentionRate: 0,
        firstPartyCitationShare: 0,
        observations: [],
        errors: [],
        cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
      },
      evidence: [],
      nextActions: [],
      guardrails: [],
      analyzedAt: "2026-07-23T00:00:00.000Z",
    } satisfies AnalyzeResult;

    await store.save(result);
    const loaded = await store.loadLatest("dosacc.com");
    expect(loaded?.project.brandGuess).toBe("Dosacc");
  });

  it("builds a delta after a second analyze", async () => {
    const store = createFileProjectStore(dir);
    const base = {
      project: { id: "p1", domain: "dosacc.com", brandGuess: "Dosacc", url: "https://dosacc.com/" },
      seo: {
        site: {
          score: 70,
          band: "good",
          pagesScanned: 2,
          pagesFailed: 0,
          totalIssues: 5,
          critical: 1,
          high: 2,
          quickWins: 2,
          worstPages: [],
          topIssues: [],
        },
        pages: [],
        siteIssues: [],
        scannedAt: "2026-07-01T00:00:00.000Z",
        finalUrl: "https://dosacc.com/",
        origin: "https://dosacc.com",
      },
      geo: {
        runId: "g1",
        model: "gemini-flash-latest",
        sampleSize: 6,
        brandMentionRate: 10,
        firstPartyCitationShare: 0,
        observations: [],
        errors: [],
        cost: { provider: "gemini" as const, estimatedUsd: 0, tokens: 0 },
      },
      evidence: [],
      nextActions: [],
      guardrails: [],
      analyzedAt: "2026-07-01T00:00:00.000Z",
    } satisfies AnalyzeResult;

    await store.save(base);
    await store.save({
      ...base,
      seo: {
        ...base.seo,
        site: { ...base.seo.site, score: 88, totalIssues: 2, critical: 0, high: 1 },
      },
      geo: { ...base.geo, runId: "g2", brandMentionRate: 40, firstPartyCitationShare: 5 },
      analyzedAt: "2026-07-23T00:00:00.000Z",
    });

    const delta = await store.loadDelta("dosacc.com");
    expect(delta).not.toBeNull();
    expect(delta?.metrics.find((m) => m.key === "seoScore")?.delta).toBe(18);
    expect(delta?.metrics.find((m) => m.key === "brandMentionRate")?.improved).toBe(true);
  });
});
