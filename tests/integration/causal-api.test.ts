// tests/integration/causal-api.test.ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/causal/route";
import { generatePair } from "@/tests/support/causal-synthetic";

function req(body: unknown): Request {
  return new Request("http://localhost/api/causal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/causal", () => {
  it("runs end-to-end and returns an honest lift report", async () => {
    const { treat, control, startedAt } = generatePair({
      baseline: 300,
      noise: 0.05,
      preDays: 21,
      postDays: 21,
      trueLiftPct: 15,
      seed: 9,
    });
    const res = await POST(
      req({
        intervention: { id: "iv1", channel: "google_ads", hypothesis: "x", startedAt, geoScope: "treat" },
        constraints: { markets: 3, dailyOutcomeVolume: 400, canPulseBudget: true },
        treatSeries: treat,
        controlSeries: control,
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.design.rung).toBe("geo_holdout");
    expect(json.lift.method).toBe("diff_in_diff");
    expect(json.honest).toMatch(/confidence/i);
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(req({ nope: true }));
    expect(res.status).toBe(400);
  });
});
