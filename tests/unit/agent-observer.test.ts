import { describe, expect, it } from "vitest";
import { createObserverAgent } from "@/lib/agents/impl/observer";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import type { RunContext } from "@/lib/agents/agent";
import { emptyCost } from "@/lib/agents/types";

function ctx(): RunContext {
  const store = new InMemoryRuntimeStore();
  return {
    store,
    now: () => new Date("2026-07-23T12:00:00.000Z"),
    client: {
      id: "c1",
      domain: "dosacc.com",
      brand: "DiligenceOS",
      cadenceHours: 168,
      costBudget: { maxTokensPerRun: 1000, maxApiCallsPerRun: 10, maxMsPerRun: 60000 },
    },
    run: {
      id: "r1",
      clientId: "c1",
      status: "running",
      trigger: "cron",
      startedAt: "2026-07-23T12:00:00.000Z",
      budget: { maxMs: 60000, maxTokens: 1000, maxApiCalls: 10 },
      spent: emptyCost(),
    },
    step: {
      id: "s1",
      runId: "r1",
      agentName: "observer",
      ordinal: 0,
      status: "running",
      attempts: 0,
      cost: emptyCost(),
      notes: [],
    },
  };
}

const seo = { score: 99, pagesScanned: 19, contentHash: "hash-a", issues: ["thin content /us/"] };
const geo = {
  mentionRate: 0,
  sampleSize: 6,
  model: "gemini-flash-latest",
  citedOthers: ["reddit.com"],
};

describe("observer agent", () => {
  it("runs when there is no prior observation", async () => {
    const agent = createObserverAgent({
      scan: async () => seo,
      probe: async () => geo,
      lastObservation: async () => null,
    });
    expect(await agent.shouldRun(ctx())).toEqual({ run: true, reason: "no prior observation" });
  });

  it("skips when the content hash is unchanged", async () => {
    const agent = createObserverAgent({
      scan: async () => seo,
      probe: async () => geo,
      lastObservation: async () => seo,
    });
    const verdict = await agent.shouldRun(ctx());
    expect(verdict.run).toBe(false);
    expect(verdict.reason).toBe("no crawl delta since last observation");
  });

  it("proposes an observation carrying seo and geo readings", async () => {
    const agent = createObserverAgent({ scan: async () => seo, probe: async () => geo });
    const result = await agent.execute(ctx());

    expect(result.status).toBe("ok");
    expect(result.proposals.length).toBe(1);
    const proposal = result.proposals[0]!;
    expect(proposal.target.type).toBe("observation");
    expect(proposal.dedupeKey).toBe("observation:2026-07-23");
    expect(proposal.riskTier).toBe("low");
    expect(proposal.payload).toEqual({ seo, geo });
    expect(result.cost.apiCalls).toBe(2);
  });

  it("degrades to skipped when the geo provider fails", async () => {
    const agent = createObserverAgent({
      scan: async () => seo,
      probe: async () => {
        throw new Error("Gemini HTTP 429");
      },
    });
    const result = await agent.execute(ctx());

    expect(result.status).toBe("skipped");
    expect(result.notes[0]).toContain("Gemini HTTP 429");
    expect(result.proposals).toEqual([]);
  });
});
