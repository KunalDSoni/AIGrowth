import { describe, expect, it } from "vitest";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import { createRegistry } from "@/lib/agents/registry";
import { advanceRun, MAX_STEP_ATTEMPTS, startRun } from "@/lib/agents/runner";
import type { Agent } from "@/lib/agents/agent";
import type { ClientRecord, StepResult } from "@/lib/agents/types";
import { emptyCost } from "@/lib/agents/types";

const client: ClientRecord = {
  id: "c1",
  domain: "dosacc.com",
  brand: "DiligenceOS",
  cadenceHours: 168,
  costBudget: { maxTokensPerRun: 1_000, maxApiCallsPerRun: 10, maxMsPerRun: 60_000 },
};

function agent(name: Agent["name"], result: () => Promise<StepResult>): Agent {
  return {
    name,
    costClass: "cheap",
    async shouldRun() {
      return { run: true, reason: "test" };
    },
    execute: result,
  };
}

const ok = (tokens = 10): StepResult => ({
  status: "ok",
  proposals: [],
  cost: { tokens, apiCalls: 1, ms: 5 },
  notes: [],
});

describe("advanceRun", () => {
  it("executes every step and completes the run", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const registry = createRegistry([
      agent("observer", async () => ok()),
      agent("strategist", async () => ok()),
    ]);
    const run = await startRun(store, client, "manual", ["observer", "strategist"]);

    const result = await advanceRun({ store, registry, client, run });

    expect(result.stepsExecuted).toBe(2);
    expect(result.run.status).toBe("done");
    expect(result.run.spent.tokens).toBe(20);
    expect((await store.listSteps(run.id)).map((s) => s.status)).toEqual(["ok", "ok"]);
  });

  it("resumes across ticks without repeating completed steps", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const registry = createRegistry([
      agent("observer", async () => ok()),
      agent("strategist", async () => ok()),
    ]);
    const run = await startRun(store, client, "cron", ["observer", "strategist"]);

    const first = await advanceRun({ store, registry, client, run, maxSteps: 1 });
    expect(first.stepsExecuted).toBe(1);
    expect(first.run.status).toBe("running");

    const second = await advanceRun({ store, registry, client, run: first.run });
    expect(second.stepsExecuted).toBe(1);
    expect(second.run.status).toBe("done");
    expect((await store.listSteps(run.id)).filter((s) => s.status === "ok").length).toBe(2);
  });

  it("keeps completed work when a later step throws", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const registry = createRegistry([
      agent("observer", async () => ok()),
      agent("strategist", async () => {
        throw new Error("provider exploded");
      }),
    ]);
    const run = await startRun(store, client, "cron", ["observer", "strategist"]);

    const result = await advanceRun({ store, registry, client, run });

    const steps = await store.listSteps(run.id);
    expect(steps[0]!.status).toBe("ok");
    expect(steps[1]!.status).toBe("pending");
    expect(steps[1]!.attempts).toBe(1);
    expect(steps[1]!.error).toBe("provider exploded");
    expect(result.run.status).toBe("running");
  });

  it("blocks the run after MAX_STEP_ATTEMPTS failures", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const registry = createRegistry([
      agent("observer", async () => {
        throw new Error("always fails");
      }),
    ]);
    let run = await startRun(store, client, "cron", ["observer"]);

    for (let i = 0; i < MAX_STEP_ATTEMPTS; i += 1) {
      run = (await advanceRun({ store, registry, client, run })).run;
    }

    expect(run.status).toBe("blocked");
    const steps = await store.listSteps(run.id);
    expect(steps[0]!.status).toBe("failed");
    expect(steps[0]!.attempts).toBe(MAX_STEP_ATTEMPTS);
  });

  it("skips a step whose agent declines to run, without spending cost", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const skipper: Agent = {
      name: "observer",
      costClass: "cheap",
      async shouldRun() {
        return { run: false, reason: "no crawl delta" };
      },
      async execute() {
        throw new Error("must not execute");
      },
    };
    const registry = createRegistry([skipper]);
    const run = await startRun(store, client, "cron", ["observer"]);

    const result = await advanceRun({ store, registry, client, run });

    const steps = await store.listSteps(run.id);
    expect(steps[0]!.status).toBe("skipped");
    expect(steps[0]!.notes).toContain("no crawl delta");
    expect(result.run.spent).toEqual(emptyCost());
    expect(result.run.status).toBe("done");
  });

  it("pauses at a step boundary when the cost budget is exhausted", async () => {
    const store = new InMemoryRuntimeStore();
    const tightClient: ClientRecord = {
      ...client,
      id: "c-tight",
      costBudget: { maxTokensPerRun: 10, maxApiCallsPerRun: 10, maxMsPerRun: 60_000 },
    };
    await store.upsertClient(tightClient);
    const registry = createRegistry([
      agent("observer", async () => ok(10)),
      agent("strategist", async () => ok(10)),
    ]);
    const run = await startRun(store, tightClient, "cron", ["observer", "strategist"]);

    const result = await advanceRun({ store, registry, client: tightClient, run });

    expect(result.stepsExecuted).toBe(1);
    expect(result.stopReason).toBe("token budget exhausted");
    expect(result.run.status).toBe("running");
  });

  it("records proposals returned by an agent", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const registry = createRegistry([
      agent("diagnosis", async () => ({
        status: "ok",
        cost: { tokens: 5, apiCalls: 1, ms: 5 },
        notes: [],
        proposals: [
          {
            kind: "create",
            target: { type: "page-change" },
            payload: { title: "Add answer section" },
            rationale: "Absent from buyer prompts",
            evidenceIds: ["ev-1"],
            riskTier: "low",
            dedupeKey: "gap:answer-section",
            estimatedImpact: "+2 pts",
            effortHours: 2,
            costToProduce: 0.2,
          },
        ],
      })),
    ]);
    const run = await startRun(store, client, "cron", ["diagnosis"]);

    await advanceRun({ store, registry, client, run });

    const proposals = await store.listProposals({ clientId: "c1", status: "pending" });
    expect(proposals.length).toBe(1);
    expect(proposals[0]!.agentName).toBe("diagnosis");
  });
});
