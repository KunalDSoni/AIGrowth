import { describe, expect, it } from "vitest";
import { buildMarketingOS, recommendTactics, buildCampaignPack } from "@/lib/marketing/os";
import { demoAnalyzeForMarketing } from "@/tests/fixtures/marketing";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";

describe("Marketing OS", () => {
  it("builds a full Phases 1–5 snapshot from demo analyze", () => {
    const result = demoAnalyzeForMarketing();
    result.intelligence = buildLiveIntelligence(result);
    const os = buildMarketingOS(result, { hoursPerWeek: 8 });

    expect(os.phaseCoverage).toEqual([1, 2, 3, 4, 5]);
    expect(os.report.improvisation.some((s) => s.bucket === "fix")).toBe(true);
    expect(os.report.improvisation.some((s) => s.bucket === "measure")).toBe(true);
    expect(os.packs.length).toBeGreaterThan(3);
    expect(os.channelMix.length).toBeGreaterThan(0);
    expect(os.outreach.length).toBeGreaterThan(0);
    expect(os.weekly.nextActions.length).toBeGreaterThan(0);
    expect(os.agencyClients.length).toBeGreaterThan(0);
    expect(os.pods[0]?.status).toBe("awaiting-approval");
    expect(os.connectors.some((c) => c.id === "gsc")).toBe(true);
    expect(os.simulations.length).toBeGreaterThan(0);
    expect(os.agentLog.some((a) => a.status === "needs_approval")).toBe(true);
  });

  it("creates claim-checked campaign pack assets", () => {
    const result = demoAnalyzeForMarketing();
    result.intelligence = buildLiveIntelligence(result);
    const tactic = recommendTactics(result)[0];
    const pack = buildCampaignPack(tactic, result);
    expect(pack.assets.length).toBeGreaterThan(0);
    expect(pack.status).toBe("draft");
  });
});
