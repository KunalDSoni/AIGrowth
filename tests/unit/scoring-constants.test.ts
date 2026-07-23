import { describe, expect, it } from "vitest";
import { READINESS_BANDS, SEVERITY } from "@/lib/engines/scoring-constants";
import type { Severity } from "@/lib/domain/types";

const order: Severity[] = ["critical", "high", "quick-win", "monitor", "ignore"];

describe("SEVERITY registry", () => {
  it("covers every severity with a rationale", () => {
    for (const s of order) {
      expect(SEVERITY[s]).toBeDefined();
      expect(SEVERITY[s].rationale.length).toBeGreaterThan(10);
    }
  });

  it("has strictly decreasing penalty and rank by severity", () => {
    for (let i = 1; i < order.length; i += 1) {
      expect(SEVERITY[order[i - 1]!].scorePenalty).toBeGreaterThan(SEVERITY[order[i]!].scorePenalty - 1);
      expect(SEVERITY[order[i - 1]!].rank).toBeGreaterThan(SEVERITY[order[i]!].rank);
    }
    expect(SEVERITY.ignore.scorePenalty).toBe(0);
    expect(SEVERITY.ignore.rank).toBe(0);
  });

  it("preserves the existing penalty values", () => {
    expect(SEVERITY.critical.scorePenalty).toBe(15);
    expect(SEVERITY.high.scorePenalty).toBe(6);
    expect(SEVERITY["quick-win"].scorePenalty).toBe(3);
    expect(SEVERITY.monitor.scorePenalty).toBe(1);
  });

  it("preserves the existing rank values", () => {
    expect(SEVERITY.critical.rank).toBe(4);
    expect(SEVERITY.high.rank).toBe(3);
    expect(SEVERITY["quick-win"].rank).toBe(2);
    expect(SEVERITY.monitor.rank).toBe(1);
  });
});

describe("READINESS_BANDS", () => {
  it("is sorted strictly descending by min and ends at 0", () => {
    for (let i = 1; i < READINESS_BANDS.length; i += 1) {
      expect(READINESS_BANDS[i - 1]!.min).toBeGreaterThan(READINESS_BANDS[i]!.min);
    }
    expect(READINESS_BANDS.at(-1)!.min).toBe(0);
  });

  it("names the expected cutoffs", () => {
    expect(READINESS_BANDS.map((b) => b.min)).toEqual([85, 70, 50, 0]);
    expect(READINESS_BANDS.map((b) => b.band)).toEqual(["excellent", "good", "fair", "poor"]);
  });
});
