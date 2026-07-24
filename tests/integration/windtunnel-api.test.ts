// tests/integration/windtunnel-api.test.ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/wind-tunnel/route";
import { fixtureEvidence } from "@/tests/support/windtunnel-fixtures";

function req(body: unknown): Request {
  return new Request("http://localhost/api/wind-tunnel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/wind-tunnel", () => {
  it("runs end-to-end and returns a SYNTHETIC report", async () => {
    const res = await POST(
      req({
        evidence: fixtureEvidence,
        stimulus: {
          id: "s1",
          kind: "headline",
          variants: [
            { id: "v1", text: "Enterprise-grade platform for large teams" },
            { id: "v2", text: "Fast simple onboarding, setup in minutes" },
          ],
        },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.label).toBe("SYNTHETIC");
    expect(json.ranking[0].variantId).toBe("v2");
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(req({ nope: true }));
    expect(res.status).toBe(400);
  });
});
