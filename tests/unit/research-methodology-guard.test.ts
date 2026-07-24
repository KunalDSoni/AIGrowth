import { describe, expect, it } from "vitest";
import {
  evaluateMethodology,
  METHODOLOGY_GUARD,
  METHODOLOGY_GUARD_VERSION,
  type PreRegistration,
  type SampleProfile,
} from "@/lib/engines/research-methodology-guard";

const validReg = (over: Partial<PreRegistration> = {}): PreRegistration => ({
  hypothesis: "Freelancers raised rates in 2026",
  method: "Aggregated public rate-card postings, deduplicated by author",
  metric: "median hourly rate",
  minSampleSize: 30,
  registeredAt: "2026-07-24T00:00:00.000Z",
  ...over,
});

// Spread across enough distinct sources that no single one dominates.
const evenSources = (n: number): Record<string, number> => {
  const perSource = Math.ceil(n / 5);
  const counts: Record<string, number> = {};
  let left = n;
  for (let i = 0; i < 5 && left > 0; i++) {
    const take = Math.min(perSource, left);
    counts[`src-${i}`] = take;
    left -= take;
  }
  return counts;
};

const sample = (n: number, over: Partial<SampleProfile> = {}): SampleProfile => ({
  n,
  sourceCounts: evenSources(n),
  ...over,
});

describe("research methodology guard", () => {
  it("exposes a version", () => {
    expect(METHODOLOGY_GUARD_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("marks a well-powered, well-sourced study as supported and publishable", () => {
    const v = evaluateMethodology(validReg(), sample(40));
    expect(v.strength).toBe("supported");
    expect(v.publishable).toBe(true);
    expect(v.checks.every((c) => c.passed)).toBe(true);
  });

  it("blocks a claim below the hard sample floor as insufficient and not publishable", () => {
    const v = evaluateMethodology(validReg(), sample(METHODOLOGY_GUARD.DIRECTIONAL_MIN_N - 1));
    expect(v.strength).toBe("insufficient");
    expect(v.publishable).toBe(false);
    expect(v.blockedReasons.some((r) => /too small/i.test(r))).toBe(true);
    expect(v.statement).toMatch(/will not publish/i);
  });

  it("caps at directional when n is between the floor and the pre-committed minimum", () => {
    const v = evaluateMethodology(validReg({ minSampleSize: 30 }), sample(20));
    expect(v.strength).toBe("directional");
    expect(v.publishable).toBe(true);
    expect(v.statement).toMatch(/directionally indicates/i);
  });

  it("refuses a study whose method was not fully pre-registered", () => {
    const v = evaluateMethodology(validReg({ hypothesis: "  " }), sample(40));
    expect(v.strength).toBe("insufficient");
    expect(v.publishable).toBe(false);
    expect(v.checks.find((c) => c.id === "pre-registration")?.passed).toBe(false);
  });

  it("rejects a zero or negative pre-committed sample target", () => {
    const v = evaluateMethodology(validReg({ minSampleSize: 0 }), sample(40));
    expect(v.checks.find((c) => c.id === "pre-registration")?.passed).toBe(false);
    expect(v.publishable).toBe(false);
  });

  it("drops to insufficient when a single source supplies almost all observations", () => {
    const v = evaluateMethodology(validReg(), {
      n: 100,
      sourceCounts: { dominant: 95, other: 5 },
    });
    expect(v.strength).toBe("insufficient");
    expect(v.publishable).toBe(false);
    expect(v.blockedReasons.some((r) => /not representative/i.test(r))).toBe(true);
  });

  it("caps at directional under soft single-source dominance even with a large n", () => {
    const v = evaluateMethodology(validReg(), {
      n: 100,
      sourceCounts: { big: 80, a: 10, b: 10 },
    });
    expect(v.strength).toBe("directional");
    expect(v.publishable).toBe(true);
    expect(v.checks.find((c) => c.id === "source-representativeness")?.passed).toBe(false);
  });

  it("caps at directional when a pre-declared segment lacks coverage", () => {
    const v = evaluateMethodology(validReg({ segments: ["design", "dev"] }), {
      ...sample(40),
      segmentCounts: { design: 35, dev: 2 },
    });
    expect(v.strength).toBe("directional");
    expect(v.checks.find((c) => c.id === "segment-coverage")?.passed).toBe(false);
    expect(v.blockedReasons.some((r) => /dev/.test(r))).toBe(true);
  });

  it("passes segment coverage when every pre-declared segment meets the minimum", () => {
    const v = evaluateMethodology(validReg({ segments: ["design", "dev"] }), {
      ...sample(40),
      segmentCounts: { design: 20, dev: 20 },
    });
    expect(v.strength).toBe("supported");
    expect(v.checks.find((c) => c.id === "segment-coverage")?.passed).toBe(true);
  });

  it("takes the weakest cap across multiple failing checks", () => {
    // Small-but-directional n AND soft source dominance → still directional, not supported.
    const v = evaluateMethodology(validReg({ minSampleSize: 50 }), {
      n: 20,
      sourceCounts: { big: 16, a: 4 },
    });
    expect(v.strength).toBe("directional");
    expect(v.blockedReasons.length).toBeGreaterThanOrEqual(2);
  });

  it("carries method and metric into the published statement", () => {
    const v = evaluateMethodology(validReg(), sample(40));
    expect(v.statement).toContain("median hourly rate");
    expect(v.statement).toContain("Aggregated public rate-card postings");
  });
});
