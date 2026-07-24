import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { POST } from "@/app/api/geo-fixes/ship/route";
import { getProjectStore } from "@/lib/projects/store";
import { loadInterventions } from "@/lib/engines/geo-fix-store";
import { makeAnalyzeResult } from "../support/analyze-input";
import type { CitationFix } from "@/lib/engines/geo-citation-fix";

const prev = process.env.OPENGROWTH_DATA_DIR;
beforeAll(() => {
  process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "shiproute-"));
});
afterAll(() => {
  process.env.OPENGROWTH_DATA_DIR = prev;
});

function req(body: unknown): Request {
  return new Request("http://test.local/api/geo-fixes/ship", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function fix(): CitationFix {
  return {
    id: "fix-faq-block",
    fixTypeId: "faq-block",
    feature: "hasFaqStructure",
    title: "Add an FAQ block",
    whatToCreate: "Add a Q&A block.",
    whyItEarnsCitations: "FAQ maps to questions.",
    affectedPrompts: ["obs-0"],
    competitorShare: 0.5,
    effort: "low",
    expectedLiftBand: "moderate",
    priority: 2,
    confidence: "Medium",
    evidenceIds: [],
    assumptions: ["directional"],
  };
}

describe("POST /api/geo-fixes/ship", () => {
  it("400s when required fields are missing", async () => {
    expect((await POST(req({ domain: "x.invalid" }))).status).toBe(400);
  });

  it("409s when the domain was never analysed", async () => {
    const res = await POST(req({ domain: "never.invalid", fix: fix(), approvedBy: "kunal" }));
    expect(res.status).toBe(409);
  });

  it("ships an approved fix and persists the intervention", async () => {
    const scan = makeAnalyzeResult({ domain: "ship-route.invalid", geoSampleSize: 4 });
    const answered = {
      ...scan,
      geo: { ...scan.geo, observations: scan.geo.observations.map((o, i) => ({ ...o, id: `obs-${i}`, rawResponse: "a" })) },
    };
    await getProjectStore().save(answered);

    const res = await POST(req({ domain: "ship-route.invalid", fix: fix(), approvedBy: "kunal" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intervention.fixId).toBe("fix-faq-block");
    expect(loadInterventions("ship-route.invalid")).toHaveLength(1);
  });

  it("400s on anonymous approval", async () => {
    const scan = makeAnalyzeResult({ domain: "ship-anon.invalid", geoSampleSize: 4 });
    await getProjectStore().save({
      ...scan,
      geo: { ...scan.geo, observations: scan.geo.observations.map((o, i) => ({ ...o, id: `obs-${i}`, rawResponse: "a" })) },
    });
    const res = await POST(req({ domain: "ship-anon.invalid", fix: fix(), approvedBy: "" }));
    expect(res.status).toBe(400);
  });
});
