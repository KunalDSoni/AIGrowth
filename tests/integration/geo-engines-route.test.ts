import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET } from "@/app/api/geo-engines/route";
import { getProjectStore } from "@/lib/projects/store";
import { makeAnalyzeResult } from "../support/analyze-input";

const prevDir = process.env.OPENGROWTH_DATA_DIR;
const prevKeys = { p: process.env.PERPLEXITY_API_KEY, o: process.env.OPENAI_API_KEY, g: process.env.GEMINI_API_KEY };
beforeAll(() => {
  process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "engines-"));
  delete process.env.PERPLEXITY_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
});
afterAll(() => {
  process.env.OPENGROWTH_DATA_DIR = prevDir;
  if (prevKeys.p) process.env.PERPLEXITY_API_KEY = prevKeys.p;
  if (prevKeys.o) process.env.OPENAI_API_KEY = prevKeys.o;
  if (prevKeys.g) process.env.GEMINI_API_KEY = prevKeys.g;
});

const req = (q = "") => new Request(`http://test.local/api/geo-engines${q}`);

describe("GET /api/geo-engines", () => {
  it("400s without a domain", async () => {
    expect((await GET(req())).status).toBe(400);
  });

  it("409s when the domain was never analysed", async () => {
    expect((await GET(req("?domain=never.invalid"))).status).toBe(409);
  });

  it("returns a mock-only cross-engine ledger for a scanned domain (offline)", async () => {
    const scan = makeAnalyzeResult({ domain: "engines-seed.invalid", geoSampleSize: 3 });
    await getProjectStore().save({
      ...scan,
      geo: {
        ...scan.geo,
        observations: scan.geo.observations.map((o, i) => ({ ...o, id: `obs-${i}`, rawResponse: "a", prompt: `Q${i}` })),
      },
    });
    const res = await GET(req("?domain=engines-seed.invalid"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.engines.map((e: { engine: string }) => e.engine)).toEqual(["mock"]);
    expect(body.report.engines[0].measurement).toBe("simulated");
  });
});
