/**
 * Proposal recording.
 *
 * Rediscovery of a known finding updates the existing proposal rather than
 * stacking a duplicate into the operator queue. A human "no" is durable:
 * rejected proposals stay rejected. An accepted proposal that recurs means the
 * fix did not hold, so it returns to the queue as pending.
 */

import type { RuntimeStore } from "@/lib/agents/store";
import type { AgentName, Proposal, ProposalDraft } from "@/lib/agents/types";

export interface ProposalContext {
  clientId: string;
  runId: string;
  agentName: AgentName;
}

export async function recordProposals(
  store: RuntimeStore,
  ctx: ProposalContext,
  drafts: ProposalDraft[],
): Promise<Proposal[]> {
  const recorded: Proposal[] = [];
  for (const draft of drafts) {
    const existing = await store.findProposalByDedupeKey(ctx.clientId, draft.dedupeKey);

    if (existing?.status === "rejected") {
      recorded.push(existing);
      continue;
    }

    recorded.push(
      await store.upsertProposal({
        ...draft,
        clientId: ctx.clientId,
        runId: ctx.runId,
        agentName: ctx.agentName,
        status: "pending",
      }),
    );
  }
  return recorded;
}
