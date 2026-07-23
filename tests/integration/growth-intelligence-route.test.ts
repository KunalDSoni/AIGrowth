import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/growth-intelligence/route";
import { getProjectStore } from "@/lib/projects/store";
import { makeAnalyzeResult } from "../support/analyze-input";

function request(query = ""): Request {
  return new Request(`http://test.local/api/growth-intelligence${query}`);
}

describe("GET /api/growth-intelligence", () => {
  it("returns 400 when no domain is supplied", async () => {
    const res = await GET(request());
    expect(res.status).toBe(400);
  });

  it("returns 409 needsScan when the domain was never analysed", async () => {
    const res = await GET(request("?domain=never-scanned.invalid"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.needsScan).toBe(true);
  });

  it("returns a Growth Intelligence report for a scanned domain", async () => {
    const scan = makeAnalyzeResult({
      domain: "seeded-growth.invalid",
      geoSampleSize: 2,
      brandMentionRate: 0,
      citedDomains: ["ref.example"],
    });
    await getProjectStore().save(scan);

    const res = await GET(request("?domain=seeded-growth.invalid"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.report.domain).toBe("seeded-growth.invalid");
    expect(body.report.pillars).toHaveLength(6);
    expect(body.report.guardrails.length).toBeGreaterThan(0);
  });
});
