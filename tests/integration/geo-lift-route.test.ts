import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET } from "@/app/api/geo-lift/route";
import { saveLift } from "@/lib/engines/geo-fix-store";
import type { CitationLift } from "@/lib/engines/geo-lift";

const prev = process.env.OPENGROWTH_DATA_DIR;
beforeAll(() => {
  process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "liftroute-"));
});
afterAll(() => {
  process.env.OPENGROWTH_DATA_DIR = prev;
});

function req(query = ""): Request {
  return new Request(`http://test.local/api/geo-lift${query}`);
}

function lift(fixId: string): CitationLift {
  return {
    fixId,
    feature: "hasFaqStructure",
    affectedPrompts: ["p1"],
    baseline: { answered: 4, brandCited: 0, citedShare: 0 },
    post: { answered: 4, brandCited: 3, citedShare: 0.75 },
    deltaShare: 0.75,
    postInterval: { low: 30, high: 95, method: "wilson" },
    pValue: 0.01,
    significant: true,
    label: "causal",
    note: "causal",
  };
}

describe("GET /api/geo-lift", () => {
  it("400s without a domain", async () => {
    expect((await GET(req())).status).toBe(400);
  });

  it("returns an empty report for a domain with no measured lifts", async () => {
    const res = await GET(req("?domain=empty-lift.invalid"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.summary.total).toBe(0);
    expect(body.report.headline).toContain("No shipped fixes");
  });

  it("summarizes persisted lifts", async () => {
    saveLift("has-lift.invalid", lift("fix-1"));
    const res = await GET(req("?domain=has-lift.invalid"));
    const body = await res.json();
    expect(body.report.summary.total).toBe(1);
    expect(body.report.summary.causal).toBe(1);
    expect(body.report.rows[0].fixId).toBe("fix-1");
  });
});
