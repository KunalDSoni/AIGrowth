import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { FileAuditRunRepository } from "@/lib/repositories/audit-runs";

const issue = {
  id: "meta",
  ruleId: "metadata.unique",
  category: "On-page",
  severity: "monitor" as const,
  title: "Check metadata",
  description: "Description",
  recommendedAction: "Rewrite metadata.",
  affectedPages: 1,
  evidenceIds: ["ev"],
  impactArea: "metadata" as const,
};

describe("file audit run repository", () => {
  it("saves and returns the latest run for a project", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opengrowth-audit-"));
    try {
      const repository = new FileAuditRunRepository(join(dir, "runs.json"));
      await repository.save({ projectId: "northstar", url: "https://one.example", source: "simulated", status: "completed", startedAt: "2026-07-23T00:00:00.000Z", completedAt: "2026-07-23T00:00:01.000Z", simulatedIssues: true, issues: [issue], evidence: [] });
      const second = await repository.save({ projectId: "northstar", url: "https://two.example", source: "safe-crawler", status: "completed", startedAt: "2026-07-23T00:01:00.000Z", completedAt: "2026-07-23T00:01:01.000Z", simulatedIssues: false, issues: [issue], evidence: [{ id: "ev" }] });

      await expect(repository.latest("northstar")).resolves.toMatchObject({ id: second.id, source: "safe-crawler", simulatedIssues: false });
      await expect(repository.list("northstar")).resolves.toHaveLength(2);
      await expect(repository.latest("missing")).resolves.toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
