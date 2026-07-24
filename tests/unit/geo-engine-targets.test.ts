import { describe, expect, it } from "vitest";
import { buildEngineTargetPlan } from "@/lib/engines/geo-engine-targets";
import type { CrossEngineLedger, EngineCitationSummary } from "@/lib/engines/geo-cross-engine-ledger";

function summary(over: Partial<EngineCitationSummary> & { engine: string }): EngineCitationSummary {
  return {
    measurement: "measured",
    state: "absent",
    sampleSize: 4,
    reliable: true,
    citedShare: 0,
    coverage: { cited: 0, mentionedNotCited: 0, absent: 4, unanswered: 0 },
    topCompetitors: [],
    ...over,
  };
}

function cross(engines: EngineCitationSummary[]): CrossEngineLedger {
  return {
    engines,
    enginesCovered: engines.filter((e) => e.state === "covered").map((e) => e.engine),
    enginesAbsent: engines.filter((e) => e.state === "absent").map((e) => e.engine),
    enginesUnmeasured: engines.filter((e) => e.state === "unmeasured").map((e) => e.engine),
    competitorUnion: [],
    overallCitedShare: 0,
    reliable: engines.some((e) => e.reliable),
  };
}

describe("buildEngineTargetPlan", () => {
  it("targets only engines where the brand is absent, not covered ones", () => {
    const plan = buildEngineTargetPlan(
      cross([
        summary({ engine: "openai", state: "absent", topCompetitors: [{ domain: "a.com", count: 3 }] }),
        summary({ engine: "perplexity", state: "covered", citedShare: 0.8, coverage: { cited: 3, mentionedNotCited: 0, absent: 1, unanswered: 0 } }),
      ]),
    );
    expect(plan.targets.map((t) => t.engine)).toEqual(["openai"]);
    expect(plan.focusEngine).toBe("openai");
  });

  it("ranks a measured absent engine above a simulated one", () => {
    const plan = buildEngineTargetPlan(
      cross([
        summary({ engine: "mock", measurement: "simulated", state: "absent", topCompetitors: [{ domain: "a.com", count: 5 }] }),
        summary({ engine: "openai", measurement: "measured", state: "absent", topCompetitors: [{ domain: "b.com", count: 1 }] }),
      ]),
    );
    expect(plan.targets[0].engine).toBe("openai");
    expect(plan.targets[0].priority).toBeGreaterThan(plan.targets[1].priority);
  });

  it("ranks by competitor pressure among measured engines", () => {
    const plan = buildEngineTargetPlan(
      cross([
        summary({ engine: "openai", topCompetitors: [{ domain: "a.com", count: 1 }] }),
        summary({ engine: "gemini", topCompetitors: [{ domain: "b.com", count: 4 }, { domain: "c.com", count: 2 }] }),
      ]),
    );
    expect(plan.targets[0].engine).toBe("gemini");
  });

  it("carries who beats you on each target engine", () => {
    const plan = buildEngineTargetPlan(
      cross([summary({ engine: "openai", topCompetitors: [{ domain: "a.com", count: 2 }] })]),
    );
    expect(plan.targets[0].competitorsCitedThere).toEqual([{ domain: "a.com", count: 2 }]);
    expect(plan.targets[0].rationale.length).toBeGreaterThan(0);
  });

  it("returns no targets with a positive note when the brand is covered everywhere measured", () => {
    const plan = buildEngineTargetPlan(
      cross([summary({ engine: "openai", state: "covered", citedShare: 1, coverage: { cited: 4, mentionedNotCited: 0, absent: 0, unanswered: 0 } })]),
    );
    expect(plan.targets).toEqual([]);
    expect(plan.focusEngine).toBeUndefined();
    expect(plan.note).toMatch(/cited/i);
  });

  it("labels a simulated-only target as directional in its rationale", () => {
    const plan = buildEngineTargetPlan(
      cross([summary({ engine: "mock", measurement: "simulated", state: "absent", topCompetitors: [{ domain: "a.com", count: 1 }] })]),
    );
    expect(plan.targets[0].rationale.toLowerCase()).toContain("directional");
  });
});
