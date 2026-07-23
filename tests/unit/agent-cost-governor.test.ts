import { describe, expect, it } from "vitest";
import { budgetFromClient, canAfford, costToServe, remaining } from "@/lib/agents/cost-governor";
import { emptyCost } from "@/lib/agents/types";

const budget = { maxMs: 60_000, maxTokens: 10_000, maxApiCalls: 20 };

describe("cost governor", () => {
  it("derives a run budget from the client budget", () => {
    expect(
      budgetFromClient({ maxTokensPerRun: 500, maxApiCallsPerRun: 4, maxMsPerRun: 9_000 }),
    ).toEqual({ maxTokens: 500, maxApiCalls: 4, maxMs: 9_000 });
  });

  it("reports remaining headroom", () => {
    expect(remaining(budget, { tokens: 2_000, apiCalls: 5, ms: 10_000 })).toEqual({
      tokens: 8_000,
      apiCalls: 15,
      ms: 50_000,
    });
  });

  it("clamps remaining headroom at zero", () => {
    expect(remaining(budget, { tokens: 99_999, apiCalls: 99, ms: 99_999 })).toEqual({
      tokens: 0,
      apiCalls: 0,
      ms: 0,
    });
  });

  it("allows work while every dimension has headroom", () => {
    expect(canAfford(budget, emptyCost())).toEqual({ ok: true, reason: "within budget" });
  });

  it("blocks on token exhaustion and names the dimension", () => {
    expect(canAfford(budget, { tokens: 10_000, apiCalls: 0, ms: 0 })).toEqual({
      ok: false,
      reason: "token budget exhausted",
    });
  });

  it("blocks on api call exhaustion", () => {
    expect(canAfford(budget, { tokens: 0, apiCalls: 20, ms: 0 })).toEqual({
      ok: false,
      reason: "api call budget exhausted",
    });
  });

  it("blocks on time exhaustion", () => {
    expect(canAfford(budget, { tokens: 0, apiCalls: 0, ms: 60_000 })).toEqual({
      ok: false,
      reason: "time budget exhausted",
    });
  });

  it("sums cost to serve across steps", () => {
    expect(
      costToServe([
        { cost: { tokens: 100, apiCalls: 1, ms: 500 } },
        { cost: { tokens: 250, apiCalls: 2, ms: 1_500 } },
      ]),
    ).toEqual({ tokens: 350, apiCalls: 3, ms: 2_000 });
  });
});
