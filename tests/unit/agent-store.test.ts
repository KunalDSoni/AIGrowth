import { describe, expect, it } from "vitest";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import { emptyCost } from "@/lib/agents/types";

function store() {
  return new InMemoryRuntimeStore();
}

describe("InMemoryRuntimeStore", () => {
  it("creates a client and returns it by id", async () => {
    const s = store();
    const client = await s.upsertClient({
      id: "client-dosacc",
      domain: "dosacc.com",
      brand: "DiligenceOS",
      cadenceHours: 168,
      costBudget: { maxTokensPerRun: 50_000, maxApiCallsPerRun: 40, maxMsPerRun: 120_000 },
    });
    expect(client.domain).toBe("dosacc.com");
    expect(await s.getClient("client-dosacc")).toEqual(client);
  });

  it("claims only clients whose nextRunAt has passed, and leases them", async () => {
    const s = store();
    const now = new Date("2026-07-23T12:00:00.000Z");
    await s.upsertClient({
      id: "due",
      domain: "due.example",
      brand: "Due",
      cadenceHours: 24,
      nextRunAt: "2026-07-23T11:00:00.000Z",
      costBudget: { maxTokensPerRun: 10, maxApiCallsPerRun: 10, maxMsPerRun: 10 },
    });
    await s.upsertClient({
      id: "not-due",
      domain: "notdue.example",
      brand: "NotDue",
      cadenceHours: 24,
      nextRunAt: "2026-07-23T18:00:00.000Z",
      costBudget: { maxTokensPerRun: 10, maxApiCallsPerRun: 10, maxMsPerRun: 10 },
    });

    const claimed = await s.claimDueClients(now, 10, 60_000);
    expect(claimed.map((c) => c.id)).toEqual(["due"]);

    const again = await s.claimDueClients(now, 10, 60_000);
    expect(again).toEqual([]);
  });

  it("re-claims a client once its lease expires", async () => {
    const s = store();
    await s.upsertClient({
      id: "leased",
      domain: "leased.example",
      brand: "Leased",
      cadenceHours: 24,
      nextRunAt: "2026-07-23T11:00:00.000Z",
      costBudget: { maxTokensPerRun: 10, maxApiCallsPerRun: 10, maxMsPerRun: 10 },
    });
    const first = new Date("2026-07-23T12:00:00.000Z");
    expect((await s.claimDueClients(first, 10, 60_000)).length).toBe(1);

    const afterLease = new Date("2026-07-23T12:02:00.000Z");
    expect((await s.claimDueClients(afterLease, 10, 60_000)).length).toBe(1);
  });

  it("stores a run with its steps and returns the next pending step in order", async () => {
    const s = store();
    const run = await s.createRun({
      clientId: "c1",
      status: "pending",
      trigger: "cron",
      startedAt: "2026-07-23T12:00:00.000Z",
      budget: { maxMs: 1000, maxTokens: 100, maxApiCalls: 5 },
      spent: emptyCost(),
    });
    await s.createSteps([
      {
        runId: run.id,
        agentName: "observer",
        ordinal: 0,
        status: "pending",
        attempts: 0,
        cost: emptyCost(),
        notes: [],
      },
      {
        runId: run.id,
        agentName: "strategist",
        ordinal: 1,
        status: "pending",
        attempts: 0,
        cost: emptyCost(),
        notes: [],
      },
    ]);

    const next = await s.nextPendingStep(run.id);
    expect(next?.agentName).toBe("observer");

    await s.updateStep(next!.id, { status: "ok" });
    const after = await s.nextPendingStep(run.id);
    expect(after?.agentName).toBe("strategist");
  });

  it("returns null for nextPendingStep when every step is finished", async () => {
    const s = store();
    const run = await s.createRun({
      clientId: "c1",
      status: "running",
      trigger: "manual",
      startedAt: "2026-07-23T12:00:00.000Z",
      budget: { maxMs: 1000, maxTokens: 100, maxApiCalls: 5 },
      spent: emptyCost(),
    });
    await s.createSteps([
      {
        runId: run.id,
        agentName: "observer",
        ordinal: 0,
        status: "ok",
        attempts: 1,
        cost: emptyCost(),
        notes: [],
      },
    ]);
    expect(await s.nextPendingStep(run.id)).toBeNull();
  });
});
