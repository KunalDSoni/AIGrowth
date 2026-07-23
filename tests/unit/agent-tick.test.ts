import { describe, expect, it } from "vitest";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import { createRegistry } from "@/lib/agents/registry";
import { runTick } from "@/lib/agents/tick";
import type { Agent } from "@/lib/agents/agent";
import { emptyCost } from "@/lib/agents/types";

const agent: Agent = {
  name: "observer",
  costClass: "cheap",
  async shouldRun() {
    return { run: true, reason: "test" };
  },
  async execute() {
    return {
      status: "ok",
      proposals: [],
      cost: { tokens: 1, apiCalls: 1, ms: 1 },
      notes: [],
    };
  },
};

async function seed(store: InMemoryRuntimeStore, id: string, nextRunAt: string) {
  await store.upsertClient({
    id,
    domain: `${id}.example`,
    brand: id,
    cadenceHours: 24,
    nextRunAt,
    costBudget: { maxTokensPerRun: 100, maxApiCallsPerRun: 10, maxMsPerRun: 60_000 },
  });
}

const now = () => new Date("2026-07-23T12:00:00.000Z");

describe("runTick", () => {
  it("claims due clients, starts runs, and advances them", async () => {
    const store = new InMemoryRuntimeStore();
    await seed(store, "due", "2026-07-23T11:00:00.000Z");
    const registry = createRegistry([agent]);

    const report = await runTick({ store, registry, pipeline: ["observer"], now });

    expect(report.claimed).toBe(1);
    expect(report.advanced[0]!.stepsExecuted).toBe(1);
    expect(report.advanced[0]!.stopReason).toBe("pipeline complete");
  });

  it("ignores clients that are not yet due", async () => {
    const store = new InMemoryRuntimeStore();
    await seed(store, "later", "2026-07-23T18:00:00.000Z");
    const registry = createRegistry([agent]);

    const report = await runTick({ store, registry, pipeline: ["observer"], now });
    expect(report.claimed).toBe(0);
    expect(report.advanced).toEqual([]);
  });

  it("continues an existing open run instead of starting a second one", async () => {
    const store = new InMemoryRuntimeStore();
    await seed(store, "open", "2026-07-23T11:00:00.000Z");
    const client = (await store.getClient("open"))!;
    const existing = await store.createRun({
      clientId: client.id,
      status: "running",
      trigger: "cron",
      startedAt: "2026-07-23T10:00:00.000Z",
      budget: { maxMs: 60_000, maxTokens: 100, maxApiCalls: 10 },
      spent: emptyCost(),
    });
    await store.createSteps([
      {
        runId: existing.id,
        agentName: "observer",
        ordinal: 0,
        status: "pending",
        attempts: 0,
        cost: emptyCost(),
        notes: [],
      },
    ]);

    const registry = createRegistry([agent]);
    const report = await runTick({ store, registry, pipeline: ["observer"], now });

    expect(report.advanced[0]!.runId).toBe(existing.id);
  });

  it("schedules the next run when a run completes", async () => {
    const store = new InMemoryRuntimeStore();
    await seed(store, "resched", "2026-07-23T11:00:00.000Z");
    const registry = createRegistry([agent]);

    await runTick({ store, registry, pipeline: ["observer"], now });

    const client = (await store.getClient("resched"))!;
    expect(client.nextRunAt).toBe("2026-07-24T12:00:00.000Z");
    expect(client.leaseUntil).toBeUndefined();
  });

  it("respects maxClients", async () => {
    const store = new InMemoryRuntimeStore();
    await seed(store, "a", "2026-07-23T11:00:00.000Z");
    await seed(store, "b", "2026-07-23T11:00:00.000Z");
    const registry = createRegistry([agent]);

    const report = await runTick({ store, registry, pipeline: ["observer"], now, maxClients: 1 });
    expect(report.claimed).toBe(1);
  });
});
