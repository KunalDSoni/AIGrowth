import { describe, expect, it, beforeAll } from "vitest";
import { PrismaRuntimeStore } from "@/lib/agents/prisma-store";
import { emptyCost } from "@/lib/agents/types";

/**
 * Opt-in explicitly: a DATABASE_URL in .env does not mean a server is running.
 * Run with: RUN_DB_TESTS=1 DATABASE_URL=... npx vitest run tests/integration
 */
const hasDb = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

suite("PrismaRuntimeStore", () => {
  let store: PrismaRuntimeStore;
  let clientId: string;

  beforeAll(async () => {
    store = new PrismaRuntimeStore();
    const client = await store.upsertClient({
      id: "",
      domain: `itest-${Date.now()}.example`,
      brand: "Integration",
      cadenceHours: 24,
      nextRunAt: new Date(Date.now() - 1000).toISOString(),
      costBudget: { maxTokensPerRun: 1000, maxApiCallsPerRun: 10, maxMsPerRun: 60000 },
    });
    clientId = client.id;
  });

  it("round-trips a run with steps", async () => {
    const run = await store.createRun({
      clientId,
      status: "pending",
      trigger: "manual",
      startedAt: new Date().toISOString(),
      budget: { maxMs: 60000, maxTokens: 1000, maxApiCalls: 10 },
      spent: emptyCost(),
    });
    await store.createSteps([
      {
        runId: run.id,
        agentName: "observer",
        ordinal: 0,
        status: "pending",
        attempts: 0,
        cost: emptyCost(),
        notes: [],
      },
    ]);

    const next = await store.nextPendingStep(run.id);
    expect(next?.agentName).toBe("observer");

    await store.updateStep(next!.id, { status: "ok", cost: { tokens: 5, apiCalls: 1, ms: 20 } });
    const steps = await store.listSteps(run.id);
    expect(steps[0]!.status).toBe("ok");
    expect(steps[0]!.cost.tokens).toBe(5);
  });

  it("enforces dedupeKey uniqueness per client", async () => {
    const run = await store.createRun({
      clientId,
      status: "running",
      trigger: "cron",
      startedAt: new Date().toISOString(),
      budget: { maxMs: 60000, maxTokens: 1000, maxApiCalls: 10 },
      spent: emptyCost(),
    });

    const base = {
      clientId,
      runId: run.id,
      agentName: "diagnosis" as const,
      kind: "create" as const,
      target: { type: "page-change" as const },
      payload: { title: "x" },
      rationale: "first",
      evidenceIds: [],
      riskTier: "low" as const,
      dedupeKey: "itest:dupe",
      estimatedImpact: "+1",
      effortHours: 1,
      costToProduce: 0.1,
      status: "pending" as const,
    };

    const first = await store.upsertProposal(base);
    const second = await store.upsertProposal({ ...base, rationale: "second" });

    expect(second.id).toBe(first.id);
    expect(second.rationale).toBe("second");
  });
});
