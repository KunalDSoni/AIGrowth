// tests/unit/research-methodology.test.ts
import { describe, expect, it } from "vitest";
import { checkSupport, preRegister } from "@/lib/research/methodology";
import { fixtureDataset } from "@/tests/support/research-fixtures";

const method = preRegister("What % raise rates?", "rate_raisers", 30, "2026-01-01T00:00:00.000Z");

describe("preRegister", () => {
  it("captures the method before results", () => {
    expect(method.method).toBe("proportion");
    expect(method.minSampleSize).toBe(30);
    expect(method.preRegisteredAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("checkSupport", () => {
  it("supports an adequately-powered licensed dataset", () => {
    expect(checkSupport(fixtureDataset(), method).verdict).toBe("supported");
  });

  it("flags unlicensed data before anything else", () => {
    const bad = fixtureDataset({ provenance: { source: "x", license: "unknown", retrievedAt: "2026-01-01T00:00:00.000Z" } });
    expect(checkSupport(bad, method).verdict).toBe("unlicensed");
  });

  it("flags an underpowered dataset as insufficient", () => {
    const small = fixtureDataset({ observations: [{ matched: true }, { matched: false }] });
    expect(checkSupport(small, method).verdict).toBe("insufficient");
  });

  it("flags a wide-interval dataset as directional", () => {
    // n=31 (>= min) but a near-50% split at low n yields a wide interval
    const wide = fixtureDataset({
      observations: Array.from({ length: 31 }, (_, i) => ({ matched: i % 2 === 0 })),
    });
    expect(checkSupport(wide, method).verdict).toBe("directional");
  });
});
