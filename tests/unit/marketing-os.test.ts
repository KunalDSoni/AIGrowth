import { describe, expect, it } from "vitest";
import { buildMarketingOS, recommendTactics, buildCampaignPack } from "@/lib/marketing/os";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { makeAnalyzeResult } from "@/tests/support/analyze-input";

function input() {
  const result = makeAnalyzeResult({
    brand: "Test Brand",
    domain: "example.invalid",
    score: 72,
    critical: 2,
    high: 3,
    citedDomains: ["directory.invalid"],
  });
  result.intelligence = buildLiveIntelligence(result);
  return result;
}

describe("Marketing OS", () => {
  it("builds a full Phases 1-5 snapshot", () => {
    const os = buildMarketingOS(input(), { hoursPerWeek: 8 });

    expect(os.phaseCoverage).toEqual([1, 2, 3, 4, 5]);
    expect(os.report.improvisation.some((s) => s.bucket === "fix")).toBe(true);
    expect(os.report.improvisation.some((s) => s.bucket === "measure")).toBe(true);
    expect(os.packs.length).toBeGreaterThan(3);
    expect(os.channelMix.length).toBeGreaterThan(0);
    expect(os.weekly.nextActions.length).toBeGreaterThan(0);
    expect(os.pods[0]?.status).toBe("awaiting-approval");
    expect(os.connectors.some((c) => c.id === "gsc")).toBe(true);
    expect(os.simulations.length).toBeGreaterThan(0);
    expect(os.agentLog.some((a) => a.status === "needs_approval")).toBe(true);
  });

  it("lists only the analysed brand as a client, never invented prospects", () => {
    const os = buildMarketingOS(input(), { hoursPerWeek: 8 });
    expect(os.agencyClients).toHaveLength(1);
    expect(os.agencyClients[0]?.domain).toBe("example.invalid");
  });

  it("derives outreach only from observed citations", () => {
    const withCitations = buildMarketingOS(input(), { hoursPerWeek: 8 });
    expect(withCitations.outreach.every((t) => t.domain === "directory.invalid")).toBe(true);

    const none = makeAnalyzeResult({ citedDomains: [] });
    none.intelligence = buildLiveIntelligence(none);
    expect(buildMarketingOS(none, { hoursPerWeek: 8 }).outreach).toEqual([]);
  });

  it("creates claim-checked campaign pack assets", () => {
    const result = input();
    const tactic = recommendTactics(result)[0];
    const pack = buildCampaignPack(tactic, result);
    expect(pack.assets.length).toBeGreaterThan(0);
    expect(pack.status).toBe("draft");
  });
});
