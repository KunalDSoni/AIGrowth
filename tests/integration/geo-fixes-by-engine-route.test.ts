import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET } from "@/app/api/geo-fixes/by-engine/route";
import { getProjectStore } from "@/lib/projects/store";
import { saveEngineProbes } from "@/lib/engines/geo-engine-probe-store";
import { makeAnalyzeResult } from "../support/analyze-input";
import type { EngineGeoResult } from "@/lib/engines/geo-multi-engine";
import type { GeoObservation, GeoResult } from "@/lib/analyze/types";

const prev = process.env.OPENGROWTH_DATA_DIR;
beforeAll(() => {
  process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "byengine-"));
});
afterAll(() => {
  process.env.OPENGROWTH_DATA_DIR = prev;
});

const req = (q = "") => new Request(`http://test.local/api/geo-fixes/by-engine${q}`);

function obs(id: string, competitor?: string): GeoObservation {
  return {
    id,
    prompt: id,
    rawResponse: "answer",
    brandMentioned: false,
    citations: competitor ? [{ url: `https://${competitor}/x`, domain: competitor, classification: "other" as const }] : [],
  };
}

function geo(observations: GeoObservation[]): GeoResult {
  return {
    runId: "r",
    model: "m",
    sampleSize: observations.length,
    brandMentionRate: 0,
    firstPartyCitationShare: 0,
    observations,
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

const engineResult = (engine: string, g: GeoResult): EngineGeoResult => ({ engine, measurement: "measured", geo: g });

async function seedScan(domain: string) {
  const scan = makeAnalyzeResult({ domain, geoSampleSize: 3 });
  await getProjectStore().save({
    ...scan,
    geo: { ...scan.geo, observations: scan.geo.observations.map((o, i) => ({ ...o, id: `obs-${i}`, rawResponse: "a" })) },
  });
}

describe("GET /api/geo-fixes/by-engine", () => {
  it("400s without a domain", async () => {
    expect((await GET(req())).status).toBe(400);
  });

  it("409s when the domain was never analysed", async () => {
    expect((await GET(req("?domain=never.invalid"))).status).toBe(409);
  });

  it("409s when cross-engine visibility has not been run", async () => {
    await seedScan("noprobes.invalid");
    const res = await GET(req("?domain=noprobes.invalid"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.needsEngines).toBe(true);
  });

  it("returns per-engine diagnosis reports from persisted probes (offline)", async () => {
    await seedScan("byengine-seed.invalid");
    saveEngineProbes("byengine-seed.invalid", [
      engineResult("openai", geo([obs("o1", "a.com"), obs("o2", "a.com")])),
      engineResult("perplexity", geo([obs("p1")])), // no competitor → skipped
    ]);
    const res = await GET(req("?domain=byengine-seed.invalid"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports.map((r: { engine: string }) => r.engine)).toEqual(["openai"]);
    expect(body.reports[0].competitorsBeatingYou[0].domain).toBe("a.com");
    expect(body.reports[0].fixesAvailable).toBe(false); // offline, diagnosis-only
  });
});
