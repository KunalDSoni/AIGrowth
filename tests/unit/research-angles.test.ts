// tests/unit/research-angles.test.ts
import { describe, expect, it } from "vitest";
import { findAngles } from "@/lib/research/angles";
import type { CitationGap } from "@/lib/research/types";

const gaps: CitationGap[] = [
  { question: "Q crowded", topic: "t1", askVolume: 100, existingSources: 9 }, // 10
  { question: "Q whitespace", topic: "t2", askVolume: 80, existingSources: 0 }, // 80
];

describe("findAngles", () => {
  it("ranks high-demand low-coverage questions first", () => {
    const angles = findAngles(gaps);
    expect(angles[0].question).toBe("Q whitespace");
    expect(angles[0].citationPotential).toBe(80);
    expect(angles[1].citationPotential).toBe(10);
  });

  it("returns an empty list for no gaps", () => {
    expect(findAngles([])).toEqual([]);
  });
});
