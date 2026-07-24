// tests/unit/research-engine.test.ts
import { describe, expect, it } from "vitest";
import { runStudy } from "@/lib/research/engine";
import { preRegister } from "@/lib/research/methodology";
import { createFixtureProvider, fixtureDataset } from "@/tests/support/research-fixtures";
import type { StudyAngle } from "@/lib/research/types";

const angle: StudyAngle = { id: "angle_0", question: "What % raise rates?", topic: "freelancing", citationPotential: 90, rationale: "x" };
const method = preRegister("What % raise rates?", "rate_raisers", 30, "2026-01-01T00:00:00.000Z");

describe("runStudy", () => {
  it("produces a supported, citable draft study", async () => {
    const study = await runStudy({ angle, methodology: method, provider: createFixtureProvider(fixtureDataset()) });
    expect(study.check.verdict).toBe("supported");
    expect(study.finding?.headlineStat).toMatch(/62%/);
    expect(study.publishState).toBe("draft");
    expect(study.datasetSchema["@type"]).toBe("Dataset");
  });

  it("refuses to attach a finding for unlicensed data", async () => {
    const bad = fixtureDataset({ provenance: { source: "scraped", license: "unknown", retrievedAt: "2026-01-01T00:00:00.000Z" } });
    const study = await runStudy({ angle, methodology: method, provider: createFixtureProvider(bad) });
    expect(study.check.verdict).toBe("unlicensed");
    expect(study.finding).toBeNull();
  });
});
