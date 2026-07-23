import { describe, expect, it } from "vitest";
import { geoMentionMetric } from "@/lib/marketing/metrics-view";
import { formatMetric, gateMessage, isReliable } from "@/lib/metrics/format";

describe("geoMentionMetric", () => {
  it("attaches a Wilson interval and a real confidence at n=25", () => {
    const m = geoMentionMetric({ brandMentionRate: 40, sampleSize: 25 });
    expect(m.value).toBe(40);
    expect(m.interval?.method).toBe("wilson");
    expect(m.sample).toEqual({ n: 25, minReliable: 20 });
    expect(m.confidence).not.toBe("insufficient");
    expect(isReliable(m)).toBe(true);
    expect(formatMetric(m)).toBe("40%");
  });

  it("is insufficient and gated below the minimum sample", () => {
    const m = geoMentionMetric({ brandMentionRate: 33, sampleSize: 3 });
    expect(m.confidence).toBe("insufficient");
    expect(isReliable(m)).toBe(false);
    expect(gateMessage(m)).toBe("Insufficient sample — n=3, need 20");
  });
});
