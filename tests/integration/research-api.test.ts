// tests/integration/research-api.test.ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/research/route";
import { fixtureDataset, fixtureGaps } from "@/tests/support/research-fixtures";

function req(body: unknown): Request {
  return new Request("http://localhost/api/research", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/research", () => {
  it("returns ranked angles and a citable draft study", async () => {
    const res = await POST(req({ gaps: fixtureGaps, dataset: fixtureDataset(), minSampleSize: 30 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.angles[0].question).toMatch(/raise rates/i);
    expect(json.study.publishState).toBe("draft");
    expect(json.study.finding.headlineStat).toMatch(/62%/);
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(req({ nope: true }));
    expect(res.status).toBe(400);
  });
});
