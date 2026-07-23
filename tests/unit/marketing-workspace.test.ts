import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generateWorkspace,
  loadWorkspace,
  updatePackStatus,
  approvePlan,
  updateOutreachStatus,
} from "@/lib/marketing/workspace";

describe("Marketing workspace (persistent)", () => {
  it("generates, persists, and mutates pack/outreach/plan status", async () => {
    const dir = await mkdtemp(join(tmpdir(), "og-mkt-"));
    const prev = process.cwd();
    try {
      // generateWorkspace writes under process.cwd()/.data — use project cwd (already fine)
      const ws = await generateWorkspace({ useDemo: true, hoursPerWeek: 8 });
      expect(ws.packs.length).toBeGreaterThan(3);
      expect(ws.reportHtmlUrl).toMatch(/^\/api\/reports\//);
      expect(ws.weeklyHtmlUrl).toMatch(/^\/api\/reports\//);

      const loaded = await loadWorkspace(ws.domain);
      expect(loaded?.packs.length).toBe(ws.packs.length);

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

      // reload proves disk persistence
      const again = await loadWorkspace(ws.domain);
      expect(again?.packs.find((p) => p.id === packId)?.status).toBe("approved");
      expect(again?.approvals.planApproved).toBe(true);
      expect(again?.outreach.find((t) => t.id === targetId)?.status).toBe("pitched");
    } finally {
      process.chdir(prev);
      await rm(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
