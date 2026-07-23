import { describe, expect, it } from "vitest";
import { generateWorkspace } from "@/lib/marketing/workspace";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { makeAnalyzeResult } from "@/tests/support/analyze-input";

describe("simulation honesty", () => {
  it("asserts no quantitative lift and states why", async () => {
    const fixture = makeAnalyzeResult({ critical: 2, high: 3, citedDomains: ["directory.invalid"] });
    fixture.intelligence = buildLiveIntelligence(fixture);
    const ws = await generateWorkspace({ analyze: fixture, hoursPerWeek: 8, useGemini: false });

    expect(ws.simulations.length).toBeGreaterThan(0);
    for (const sim of ws.simulations) {
      expect(sim).not.toHaveProperty("expectedLeadLiftBand");
      expect(sim.liftEstimable).toBe(false);
      expect(sim.reason).toContain("baseline");
      expect(sim.costHours.unit).toBe("hours");
    }
    const serialized = JSON.stringify(ws.simulations);
    expect(serialized).not.toMatch(/\+\d+–\d+%/); // no "+8–18%" band anywhere
  });
});
