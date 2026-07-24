import { describe, expect, it } from "vitest";
import {
  buildLegibilityScore,
  compareLegibility,
  LEGIBILITY_SCORE_VERSION,
  type LegibilityScore,
} from "@/lib/engines/legibility-score";
import type { LegibilityGap } from "@/lib/engines/legibility-gap-finder";
import type { ShoppingAgentReport } from "@/lib/engines/legibility-shopping-agent-lens";

const gap = (impact: number): LegibilityGap => ({
  attribute: "price",
  kind: "mismatch",
  machineBelief: "$99",
  truth: "$20",
  contested: false,
  correctable: true,
  impact,
  category: "price",
  rationale: "x",
});

const shopping = (score: number): ShoppingAgentReport => ({
  score,
  grade: "partial",
  fields: [],
  missingRequired: [],
  mcpReady: true,
  recommendations: [],
});

const score = (over: Partial<LegibilityScore> = {}): LegibilityScore => ({
  overall: 90,
  answerEngine: 90,
  grade: "strong",
  beliefsMeasured: 10,
  method: "m",
  ...over,
});

describe("legibility score", () => {
  it("exposes a version", () => {
    expect(LEGIBILITY_SCORE_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("scores 100 answer-engine accuracy with no gaps", () => {
    const s = buildLegibilityScore({ gaps: [], beliefsMeasured: 5 });
    expect(s.answerEngine).toBe(100);
    expect(s.overall).toBe(100);
    expect(s.grade).toBe("strong");
  });

  it("penalizes accuracy by gap impact, normalized by beliefs measured", () => {
    const few = buildLegibilityScore({ gaps: [gap(90)], beliefsMeasured: 1 });
    const many = buildLegibilityScore({ gaps: [gap(90)], beliefsMeasured: 9 });
    expect(few.answerEngine).toBeLessThan(many.answerEngine);
    expect(few.answerEngine).toBe(10);
  });

  it("blends in the shopping-agent score when present", () => {
    const s = buildLegibilityScore({ gaps: [], beliefsMeasured: 5, shopping: shopping(50) });
    // 100*0.6 + 50*0.4 = 80
    expect(s.shoppingAgent).toBe(50);
    expect(s.overall).toBe(80);
  });

  it("reports improvement when the score rises with enough beliefs", () => {
    const m = compareLegibility(score({ overall: 60 }), score({ overall: 80 }));
    expect(m.label).toBe("improved");
    expect(m.delta).toBe(20);
  });

  it("reports regression when the score falls", () => {
    const m = compareLegibility(score({ overall: 80 }), score({ overall: 60 }));
    expect(m.label).toBe("regressed");
  });

  it("reports unchanged within the epsilon band", () => {
    const m = compareLegibility(score({ overall: 80 }), score({ overall: 82 }));
    expect(m.label).toBe("unchanged");
  });

  it("refuses to claim movement on too few measured beliefs", () => {
    const m = compareLegibility(
      score({ overall: 40, beliefsMeasured: 2 }),
      score({ overall: 90, beliefsMeasured: 2 }),
    );
    expect(m.label).toBe("insufficient");
    expect(m.note).toMatch(/too few/i);
  });
});
