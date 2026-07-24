// tests/unit/windtunnel-aggregate.test.ts
import { describe, expect, it } from "vitest";
import { buildObjectionMap, rankVariants, segmentDeltas } from "@/lib/windtunnel/aggregate";
import type { PersonaReaction, Stimulus } from "@/lib/windtunnel/types";

const stimulus: Stimulus = {
  id: "s1",
  kind: "headline",
  variants: [
    { id: "v1", text: "A" },
    { id: "v2", text: "B" },
  ],
};

const reactions: PersonaReaction[] = [
  {
    personaId: "p_smb",
    segment: "smb",
    choices: [
      { winnerVariantId: "v2", reason: "", objectionsRaised: ["too slow"] },
      { winnerVariantId: "v2", reason: "", objectionsRaised: ["too slow"] },
    ],
  },
  {
    personaId: "p_ent",
    segment: "enterprise",
    choices: [
      { winnerVariantId: "v1", reason: "", objectionsRaised: ["needs sso"] },
      { winnerVariantId: "v2", reason: "", objectionsRaised: [] },
    ],
  },
];

describe("rankVariants", () => {
  it("ranks by win share and includes every variant", () => {
    const ranking = rankVariants(reactions, stimulus);
    expect(ranking[0].variantId).toBe("v2");
    expect(ranking[0].wins).toBe(3);
    expect(ranking[0].samples).toBe(4);
    expect(ranking[0].winShare).toBeCloseTo(0.75, 5);
    expect(ranking.map((r) => r.variantId).sort()).toEqual(["v1", "v2"]);
  });
});

describe("buildObjectionMap", () => {
  it("dedupes objections per persona and counts overall", () => {
    const map = buildObjectionMap(reactions);
    expect(map.byPersona["p_smb"]).toEqual(["too slow"]);
    expect(map.overall.find((o) => o.objection === "too slow")?.count).toBe(2);
  });
});

describe("segmentDeltas", () => {
  it("reports per-segment win share for each variant", () => {
    const deltas = segmentDeltas(reactions, stimulus);
    const v2 = deltas.find((d) => d.variantId === "v2")!;
    expect(v2.bySegment["smb"]).toBeCloseTo(1, 5);
    expect(v2.bySegment["enterprise"]).toBeCloseTo(0.5, 5);
  });
});
