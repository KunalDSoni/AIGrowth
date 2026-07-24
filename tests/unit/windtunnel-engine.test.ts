// tests/unit/windtunnel-engine.test.ts
import { describe, expect, it } from "vitest";
import { runWindTunnelReport } from "@/lib/windtunnel/engine";
import { createHeuristicDistiller } from "@/lib/windtunnel/distiller";
import { createFakeResponder, fixtureEvidence } from "@/tests/support/windtunnel-fixtures";
import type { Stimulus } from "@/lib/windtunnel/types";

const stimulus: Stimulus = {
  id: "s1",
  kind: "headline",
  variants: [
    { id: "v1", text: "Enterprise-grade platform for large teams" },
    { id: "v2", text: "Fast simple onboarding, setup in minutes" },
  ],
};

describe("runWindTunnelReport", () => {
  it("ranks the on-voice variant top and stamps SYNTHETIC", async () => {
    const report = await runWindTunnelReport({
      evidence: fixtureEvidence,
      stimulus,
      distiller: createHeuristicDistiller(),
      responder: createFakeResponder(),
      samples: 3,
    });
    expect(report.label).toBe("SYNTHETIC");
    expect(report.disclaimer).toMatch(/synthetic/i);
    expect(report.ranking[0].variantId).toBe("v2");
    expect(report.confidence).toBe("directional");
    expect(report.personasUsed).toBeGreaterThan(0);
    expect(report.evidenceCount).toBe(fixtureEvidence.length);
  });

  it("returns insufficient (but still SYNTHETIC) when evidence is too thin", async () => {
    const report = await runWindTunnelReport({
      evidence: [{ id: "x", source: "review", segment: "smb", text: "one item", sentiment: "neutral" }],
      stimulus,
      distiller: createHeuristicDistiller(),
      responder: createFakeResponder(),
    });
    expect(report.label).toBe("SYNTHETIC");
    expect(report.confidence).toBe("insufficient");
    expect(report.ranking).toEqual([]);
    expect(report.personasUsed).toBe(0);
  });
});
