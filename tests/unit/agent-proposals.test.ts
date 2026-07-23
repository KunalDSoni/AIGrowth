import { describe, expect, it } from "vitest";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import { recordProposals } from "@/lib/agents/proposals";
import type { ProposalDraft } from "@/lib/agents/types";

function draft(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    kind: "create",
    target: { type: "page-change" },
    payload: { title: "Add FAQ answers" },
    rationale: "No answer-shaped content for buyer prompts",
    evidenceIds: ["ev-1"],
    riskTier: "low",
    dedupeKey: "gap:answer-shaped-content",
    estimatedImpact: "+2-5 pts answer share",
    effortHours: 3,
    costToProduce: 0.4,
    ...overrides,
  };
}

const ctx = { clientId: "c1", runId: "r1", agentName: "diagnosis" as const };

describe("recordProposals", () => {
  it("creates a pending proposal on first discovery", async () => {
    const store = new InMemoryRuntimeStore();
    const [proposal] = await recordProposals(store, ctx, [draft()]);
    expect(proposal!.status).toBe("pending");
    expect(proposal!.agentName).toBe("diagnosis");
    expect((await store.listProposals({ clientId: "c1" })).length).toBe(1);
  });

  it("updates in place when the same dedupeKey is rediscovered", async () => {
    const store = new InMemoryRuntimeStore();
    const [first] = await recordProposals(store, ctx, [draft()]);
    const [second] = await recordProposals(store, { ...ctx, runId: "r2" }, [
      draft({ rationale: "Still missing after 7 days", effortHours: 4 }),
    ]);

    expect(second!.id).toBe(first!.id);
    expect(second!.rationale).toBe("Still missing after 7 days");
    expect(second!.effortHours).toBe(4);
    expect(second!.runId).toBe("r2");
    expect((await store.listProposals({ clientId: "c1" })).length).toBe(1);
  });

  it("does not resurrect a rejected proposal", async () => {
    const store = new InMemoryRuntimeStore();
    const [first] = await recordProposals(store, ctx, [draft()]);
    await store.setProposalStatus(first!.id, "rejected");

    const [second] = await recordProposals(store, { ...ctx, runId: "r2" }, [draft()]);
    expect(second!.status).toBe("rejected");
    expect((await store.listProposals({ clientId: "c1", status: "pending" })).length).toBe(0);
  });

  it("supersedes an accepted proposal when the finding recurs", async () => {
    const store = new InMemoryRuntimeStore();
    const [first] = await recordProposals(store, ctx, [draft()]);
    await store.setProposalStatus(first!.id, "accepted");

    const [second] = await recordProposals(store, { ...ctx, runId: "r2" }, [draft()]);
    expect(second!.id).toBe(first!.id);
    expect(second!.status).toBe("pending");
  });

  it("keeps proposals from different clients separate", async () => {
    const store = new InMemoryRuntimeStore();
    await recordProposals(store, ctx, [draft()]);
    await recordProposals(store, { ...ctx, clientId: "c2" }, [draft()]);
    expect((await store.listProposals({ clientId: "c1" })).length).toBe(1);
    expect((await store.listProposals({ clientId: "c2" })).length).toBe(1);
  });
});
