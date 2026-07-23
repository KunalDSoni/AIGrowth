/**
 * One tick: claim due clients, advance each within budget, reschedule.
 *
 * Idempotent by lease. A crashed tick releases its clients when the lease
 * expires, so the next tick picks them up without duplicate work.
 */

import { advanceRun, startRun } from "@/lib/agents/runner";
import type { AgentRegistry } from "@/lib/agents/registry";
import type { RuntimeStore } from "@/lib/agents/store";
import type { AgentName } from "@/lib/agents/types";

export interface TickDeps {
  store: RuntimeStore;
  registry: AgentRegistry;
  pipeline: AgentName[];
  now?: () => Date;
  maxClients?: number;
  leaseMs?: number;
}

export interface TickReport {
  claimed: number;
  advanced: {
    clientId: string;
    runId: string;
    stepsExecuted: number;
    stopReason: string;
  }[];
}

export async function runTick(deps: TickDeps): Promise<TickReport> {
  const now = deps.now ?? (() => new Date());
  const maxClients = deps.maxClients ?? 5;
  const leaseMs = deps.leaseMs ?? 120_000;

  const clients = await deps.store.claimDueClients(now(), maxClients, leaseMs);
  const advanced: TickReport["advanced"] = [];

  for (const client of clients) {
    const open = await deps.store.openRunForClient(client.id);
    const run = open ?? (await startRun(deps.store, client, "cron", deps.pipeline));

    const result = await advanceRun({
      store: deps.store,
      registry: deps.registry,
      client,
      run,
      now,
    });

    if (result.run.status === "done") {
      await deps.store.upsertClient({
        ...client,
        leaseUntil: undefined,
        nextRunAt: new Date(
          now().getTime() + client.cadenceHours * 60 * 60 * 1000,
        ).toISOString(),
      });
    }

    advanced.push({
      clientId: client.id,
      runId: result.run.id,
      stepsExecuted: result.stepsExecuted,
      stopReason: result.stopReason,
    });
  }

  return { claimed: clients.length, advanced };
}
