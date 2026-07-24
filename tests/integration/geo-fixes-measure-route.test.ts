import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { POST } from "@/app/api/geo-fixes/measure/route";
import { getProjectStore } from "@/lib/projects/store";
import { saveIntervention } from "@/lib/engines/geo-fix-store";
import { makeAnalyzeResult } from "../support/analyze-input";
import type { InterventionRecord } from "@/lib/engines/geo-intervention";

const prevDir = process.env.OPENGROWTH_DATA_DIR;
const prevKey = process.env.GEMINI_API_KEY;
beforeAll(() => {
  process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "measureroute-"));
  delete process.env.GEMINI_API_KEY; // force the offline path (no live re-probe)
});
afterAll(() => {
  process.env.OPENGROWTH_DATA_DIR = prevDir;
  if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
});

function req(body: unknown): Request {
  return new Request("http://test.local/api/geo-fixes/measure", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function intervention(affected: string[]): InterventionRecord {
  return {
    id: "intervention-1",
    assetId: "asset-1",
    fixId: "fix-faq-block",
    fixTypeId: "faq-block",
    feature: "hasFaqStructure",
    affectedPrompts: affected,
    shippedAt: "2026-07-25T00:00:00.000Z",
    baseline: { runId: "b", targetPromptCount: affected.length, answered: affected.length, brandCited: 0, citedShare: 0 },
  };
}

async function seed(domain: string) {
  const scan = makeAnalyzeResult({ domain, geoSampleSize: 4 });
  await getProjectStore().save({
    ...scan,
    geo: { ...scan.geo, observations: scan.geo.observations.map((o, i) => ({ ...o, id: `obs-${i}`, rawResponse: "a" })) },
  });
}

describe("POST /api/geo-fixes/measure", () => {
  it("400s when required fields are missing", async () => {
    expect((await POST(req({ domain: "x.invalid" }))).status).toBe(400);
  });

  it("409s when the domain was never analysed", async () => {
    expect((await POST(req({ domain: "never.invalid", interventionId: "i1" }))).status).toBe(409);
  });

  it("404s when the intervention is unknown", async () => {
    await seed("measure-404.invalid");
    const res = await POST(req({ domain: "measure-404.invalid", interventionId: "missing" }));
    expect(res.status).toBe(404);
  });

  it("422s when affected prompts are not in the latest scan", async () => {
    await seed("measure-422.invalid");
    saveIntervention("measure-422.invalid", intervention(["not-a-real-id"]));
    const res = await POST(req({ domain: "measure-422.invalid", interventionId: "intervention-1" }));
    expect(res.status).toBe(422);
  });

  it("returns measured:false when no answer engine is configured", async () => {
    await seed("measure-offline.invalid");
    saveIntervention("measure-offline.invalid", intervention(["obs-0", "obs-1"]));
    const res = await POST(req({ domain: "measure-offline.invalid", interventionId: "intervention-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.measured).toBe(false);
    expect(body.note).toMatch(/answer engine/i);
  });
});
