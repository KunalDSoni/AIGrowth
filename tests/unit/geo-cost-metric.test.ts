import { describe, expect, it } from "vitest";
import { geoCostMetric } from "@/lib/marketing/metrics-view";
import { formatMetric } from "@/lib/metrics/format";

describe("geoCostMetric", () => {
  it("labels GEO cost as an estimate with its pricing assumption", () => {
    const m = geoCostMetric({ cost: { provider: "gemini", estimatedUsd: 0.12, tokens: 1_200_000 } });
    expect(m.basis).toBe("estimated");
    expect(m.assumptions?.[0]).toContain("$0.10");
    expect(formatMetric(m)).toBe("$0.12");
  });
});
