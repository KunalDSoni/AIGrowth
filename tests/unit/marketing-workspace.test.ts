import { describe, expect, it } from "vitest";
import {
  generateWorkspace,
  loadWorkspace,
  updatePackStatus,
  approvePlan,
  updateOutreachStatus,
} from "@/lib/marketing/workspace";
import { runDeepMarketingEngine } from "@/lib/marketing/deep-engine";
import { demoAnalyzeForMarketing } from "@/tests/fixtures/marketing";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";

describe("Deep marketing engine", () => {
  it("produces substantial claim-checked packs from evidence", async () => {
    const result = demoAnalyzeForMarketing();
    result.intelligence = buildLiveIntelligence(result);
    const deep = await runDeepMarketingEngine(result, { hoursPerWeek: 8, useGemini: false });

    expect(deep.context.siteFacts.length).toBeGreaterThan(8);
    expect(deep.packs.length).toBeGreaterThanOrEqual(5);
    expect(deep.report.chapters.length).toBeGreaterThanOrEqual(4);

    for (const pack of deep.packs) {
      const totalChars = pack.assets.reduce((n, a) => n + a.body.length, 0);
      expect(totalChars).toBeGreaterThan(400);
      expect(pack.siteFactsUsed.length).toBeGreaterThan(0);
      expect(pack.assets.some((a) => a.kind === "brief" || a.body.includes(deep.context.brand))).toBe(true);
      for (const asset of pack.assets) {
        expect(asset.claimFlags).toBeDefined();
      }
    }

    const service = deep.packs.find((p) => p.packType === "SERVICE");
    if (service) {
      const draft = service.assets.find((a) => a.kind === "draft");
      expect(draft?.body.length).toBeGreaterThan(500);
      expect(draft?.body).toMatch(/CONFIRM|# /);
    }
  });
});

describe("Marketing workspace (persistent + deep)", () => {
  it("generates deep packs, persists, and mutates status", async () => {
    // Fixture is passed in explicitly. The product itself can no longer
    // fabricate a stand-in project when real data is absent.
    const fixture = demoAnalyzeForMarketing();
    fixture.intelligence = buildLiveIntelligence(fixture);
    const ws = await generateWorkspace({
      analyze: fixture,
      hoursPerWeek: 8,
      useGemini: false,
    });
    expect(ws.packs.length).toBeGreaterThan(3);
    expect(ws.siteFacts.length).toBeGreaterThan(8);
    expect(ws.reportHtmlUrl).toMatch(/^\/api\/reports\//);
    expect(ws.weeklyHtmlUrl).toMatch(/^\/api\/reports\//);

    const totalChars = ws.packs.reduce((s, p) => s + p.assets.reduce((a, x) => a + x.body.length, 0), 0);
    expect(totalChars).toBeGreaterThan(3000);

    const loaded = await loadWorkspace(ws.domain);
    expect(loaded?.packs.length).toBe(ws.packs.length);
    expect(loaded?.siteFacts.length).toBe(ws.siteFacts.length);

    const packId = ws.packs[0]!.id;
    const afterPack = await updatePackStatus(ws.domain, packId, "approved");
    expect(afterPack.packs.find((p) => p.id === packId)?.status).toBe("approved");
    expect(afterPack.approvals.packsApprovedIds).toContain(packId);

    const targetId = afterPack.outreach[0]!.id;
    const afterOut = await updateOutreachStatus(ws.domain, targetId, "pitched");
    expect(afterOut.outreach.find((t) => t.id === targetId)?.status).toBe("pitched");

    const afterPlan = await approvePlan(ws.domain);
    expect(afterPlan.approvals.planApproved).toBe(true);
    expect(afterPlan.pods[0]?.status).toBe("running");

    const again = await loadWorkspace(ws.domain);
    expect(again?.packs.find((p) => p.id === packId)?.status).toBe("approved");
    expect(again?.approvals.planApproved).toBe(true);
    expect(again?.outreach.find((t) => t.id === targetId)?.status).toBe("pitched");
  }, 30_000);
});
