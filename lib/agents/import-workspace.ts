/**
 * One-shot migration from the legacy `.data/marketing-workspaces` blob store
 * into the agent runtime. Only client identity and cadence move; packs and
 * approvals stay where they are until the Operator Console plan replaces their
 * readers.
 */

import type { RuntimeStore } from "@/lib/agents/store";
import type { ClientRecord } from "@/lib/agents/types";

export interface WorkspaceIdentity {
  domain: string;
  brand: string;
}

export function clientFromWorkspace(ws: WorkspaceIdentity, now: Date): ClientRecord {
  return {
    id: `client-${ws.domain}`,
    domain: ws.domain,
    brand: ws.brand,
    cadenceHours: 168,
    nextRunAt: now.toISOString(),
    costBudget: {
      maxTokensPerRun: 50_000,
      maxApiCallsPerRun: 40,
      maxMsPerRun: 120_000,
    },
  };
}

export async function importWorkspace(
  store: RuntimeStore,
  ws: WorkspaceIdentity,
  now: Date,
): Promise<ClientRecord> {
  return store.upsertClient(clientFromWorkspace(ws, now));
}
