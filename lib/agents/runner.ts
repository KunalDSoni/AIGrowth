/**
 * The run machine.
 *
 * Steps are the unit of resumption: a failure in step N never discards the work
 * of step N-1. A tick advances a run as far as its time and cost budgets allow,
 * persisting after each step.
 */

import { budgetFromClient, canAfford } from "@/lib/agents/cost-governor";
import { recordProposals } from "@/lib/agents/proposals";
import { DEFAULT_PIPELINE } from "@/lib/agents/registry";
import type { AgentRegistry } from "@/lib/agents/registry";
import type { RuntimeStore } from "@/lib/agents/store";
import { addCost, emptyCost } from "@/lib/agents/types";
import type { AgentName, ClientRecord, CostRecord, Run, RunStep } from "@/lib/agents/types";

export const MAX_STEP_ATTEMPTS = 3;

export interface AdvanceDeps {
  store: RuntimeStore;
  registry: AgentRegistry;
  client: ClientRecord;
  run: Run;
  now?: () => Date;
  maxSteps?: number;
}

export interface AdvanceResult {
  run: Run;
  stepsExecuted: number;
  stopReason: string;
}

export async function startRun(
  store: RuntimeStore,
  client: ClientRecord,
  trigger: Run["trigger"],
  pipeline: AgentName[] = DEFAULT_PIPELINE,
): Promise<Run> {
  const run = await store.createRun({
    clientId: client.id,
    status: "pending",
    trigger,
    startedAt: new Date().toISOString(),
    budget: budgetFromClient(client.costBudget),
    spent: emptyCost(),
  });

  await store.createSteps(
    pipeline.map((agentName, ordinal) => ({
      runId: run.id,
      agentName,
      ordinal,
      status: "pending" as const,
      attempts: 0,
      cost: emptyCost(),
      notes: [],
    })),
  );

  return run;
}

export async function advanceRun(deps: AdvanceDeps): Promise<AdvanceResult> {
  const { store, registry, client } = deps;
  const now = deps.now ?? (() => new Date());
  const maxSteps = deps.maxSteps ?? Number.POSITIVE_INFINITY;

  let run = deps.run;
  let stepsExecuted = 0;

  if (run.status === "pending") {
    run = await store.updateRun(run.id, { status: "running" });
  }

  while (stepsExecuted < maxSteps) {
    const affordable = canAfford(run.budget, run.spent);
    if (!affordable.ok) {
      return { run, stepsExecuted, stopReason: affordable.reason };
    }

    const step = await store.nextPendingStep(run.id);
    if (!step) {
      run = await store.updateRun(run.id, {
        status: "done",
        finishedAt: now().toISOString(),
      });
      return { run, stepsExecuted, stopReason: "pipeline complete" };
    }

    const outcome = await executeStep({ store, registry, client, run, step, now });
    stepsExecuted += 1;

    if (outcome.blocked) {
      run = await store.updateRun(run.id, { status: "blocked" });
      return { run, stepsExecuted, stopReason: "step exceeded max attempts" };
    }

    if (outcome.cost) {
      run = await store.updateRun(run.id, { spent: addCost(run.spent, outcome.cost) });
    }

    if (outcome.retryable) {
      return { run, stepsExecuted, stopReason: "step failed, will retry next tick" };
    }
  }

  return { run, stepsExecuted, stopReason: "step limit reached" };
}

interface StepOutcome {
  blocked: boolean;
  retryable: boolean;
  cost?: CostRecord;
}

async function executeStep(args: {
  store: RuntimeStore;
  registry: AgentRegistry;
  client: ClientRecord;
  run: Run;
  step: RunStep;
  now: () => Date;
}): Promise<StepOutcome> {
  const { store, registry, client, run, step, now } = args;
  const agent = registry.get(step.agentName);

  const running = await store.updateStep(step.id, {
    status: "running",
    startedAt: now().toISOString(),
  });

  const ctx = { client, run, step: running, store, now };

  const verdict = await agent.shouldRun(ctx);
  if (!verdict.run) {
    await store.updateStep(step.id, {
      status: "skipped",
      finishedAt: now().toISOString(),
      notes: [verdict.reason],
    });
    return { blocked: false, retryable: false };
  }

  try {
    const result = await agent.execute(ctx);

    if (result.proposals.length) {
      await recordProposals(
        store,
        { clientId: client.id, runId: run.id, agentName: agent.name },
        result.proposals,
      );
    }

    await store.updateStep(step.id, {
      status: result.status,
      finishedAt: now().toISOString(),
      cost: result.cost,
      notes: result.notes,
      attempts: step.attempts + 1,
    });

    return { blocked: false, retryable: false, cost: result.cost };
  } catch (error) {
    const attempts = step.attempts + 1;
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = attempts >= MAX_STEP_ATTEMPTS;

    await store.updateStep(step.id, {
      status: exhausted ? "failed" : "pending",
      attempts,
      error: message,
      finishedAt: exhausted ? now().toISOString() : undefined,
    });

    return { blocked: exhausted, retryable: !exhausted };
  }
}
