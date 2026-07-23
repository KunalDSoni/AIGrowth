import { describe, expect, it } from "vitest";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import { clientFromWorkspace, importWorkspace } from "@/lib/agents/import-workspace";

const ws = { domain: "dosacc.com", brand: "DiligenceOS" };
const now = new Date("2026-07-23T12:00:00.000Z");

describe("workspace import", () => {
  it("derives a client with a weekly cadence due immediately", () => {
    const client = clientFromWorkspace(ws, now);
    expect(client.domain).toBe("dosacc.com");
    expect(client.brand).toBe("DiligenceOS");
    expect(client.cadenceHours).toBe(168);
    expect(client.nextRunAt).toBe("2026-07-23T12:00:00.000Z");
  });

  it("applies conservative default cost budgets", () => {
    const client = clientFromWorkspace(ws, now);
    expect(client.costBudget).toEqual({
      maxTokensPerRun: 50_000,
      maxApiCallsPerRun: 40,
      maxMsPerRun: 120_000,
    });
  });

  it("persists the client so a tick can claim it", async () => {
    const store = new InMemoryRuntimeStore();
    const client = await importWorkspace(store, ws, now);

    expect(await store.getClient(client.id)).not.toBeNull();
    const claimed = await store.claimDueClients(now, 5, 60_000);
    expect(claimed.map((c) => c.domain)).toContain("dosacc.com");
  });

  it("is idempotent for the same domain", async () => {
    const store = new InMemoryRuntimeStore();
    await importWorkspace(store, ws, now);
    await importWorkspace(store, ws, now);
    const claimed = await store.claimDueClients(now, 10, 60_000);
    expect(claimed.filter((c) => c.domain === "dosacc.com").length).toBe(1);
  });
});
