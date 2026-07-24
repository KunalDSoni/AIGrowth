import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/geo-fixes/route";
import { getProjectStore } from "@/lib/projects/store";
import { makeAnalyzeResult } from "../support/analyze-input";

function request(query = ""): Request {
  return new Request(`http://test.local/api/geo-fixes${query}`);
}

describe("GET /api/geo-fixes", () => {
  it("returns 400 when no domain is supplied", async () => {
    const res = await GET(request());
    expect(res.status).toBe(400);
  });

  it("returns 409 needsScan when the domain was never analysed", async () => {
    const res = await GET(request("?domain=never-scanned-geo.invalid"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.needsScan).toBe(true);
  });

  it("returns a diagnosis report for a scanned domain (offline, no crawl)", async () => {
    const scan = makeAnalyzeResult({ domain: "seeded-geo-fixes.invalid", geoSampleSize: 3, citedDomains: ["ref.example"] });
    const answered = {
      ...scan,
      geo: { ...scan.geo, observations: scan.geo.observations.map((o) => ({ ...o, rawResponse: "answer" })) },
    };
    await getProjectStore().save(answered);

    const res = await GET(request("?domain=seeded-geo-fixes.invalid"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.domain).toBe("seeded-geo-fixes.invalid");
    expect(body.report.competitorsBeatingYou[0].domain).toBe("ref.example");
    expect(body.report.fixesAvailable).toBe(false);
  });
});
