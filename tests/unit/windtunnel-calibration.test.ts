// tests/unit/windtunnel-calibration.test.ts
import { describe, expect, it } from "vitest";
import { createCalibrationTracker } from "@/lib/windtunnel/calibration";

describe("createCalibrationTracker", () => {
  it("computes hit rate against real outcomes", () => {
    const t = createCalibrationTracker();
    t.record({ stimulusId: "s1", predictedWinnerVariantId: "v2", actualWinnerVariantId: "v2" });
    t.record({ stimulusId: "s2", predictedWinnerVariantId: "v1", actualWinnerVariantId: "v2" });
    expect(t.hitRate()).toEqual({ hits: 1, total: 2, rate: 0.5 });
  });

  it("reports zero rate with no records", () => {
    expect(createCalibrationTracker().hitRate()).toEqual({ hits: 0, total: 0, rate: 0 });
  });
});
