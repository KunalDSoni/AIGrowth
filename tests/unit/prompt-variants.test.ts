import { describe, expect, it } from "vitest";
import { buildPromptFamily, generatePromptVariants } from "@/lib/engines/prompt-variants";

describe("generatePromptVariants", () => {
  const base = "Who provides bookkeeping for medical clinics?";

  it("always includes the base question and wording variants", () => {
    const variants = generatePromptVariants({ familyId: "f1", baseQuestion: base });
    expect(variants.some((v) => v.text === base)).toBe(true);
    expect(variants.some((v) => v.dimension === "wording" && v.label !== "direct")).toBe(true);
  });

  it("expands geography, persona and buying-stage axes with dimension tags", () => {
    const variants = generatePromptVariants({
      familyId: "f1",
      baseQuestion: base,
      axes: { geographies: ["Australia"], personas: ["practice manager"], buyingStages: ["decision"] },
    });
    expect(variants.some((v) => v.dimension === "geography" && v.text.includes("Australia"))).toBe(true);
    expect(variants.some((v) => v.dimension === "persona" && v.text.includes("practice manager"))).toBe(true);
    expect(variants.some((v) => v.dimension === "buying-stage")).toBe(true);
  });

  it("de-duplicates variants and is deterministic", () => {
    const a = generatePromptVariants({ familyId: "f1", baseQuestion: base, axes: { geographies: ["Australia"] } });
    const b = generatePromptVariants({ familyId: "f1", baseQuestion: base, axes: { geographies: ["Australia"] } });
    expect(a.map((v) => v.text)).toEqual(b.map((v) => v.text));
    const texts = a.map((v) => v.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("assigns unique ids", () => {
    const variants = generatePromptVariants({ familyId: "f1", baseQuestion: base, axes: { personas: ["founder", "cfo"] } });
    expect(new Set(variants.map((v) => v.id)).size).toBe(variants.length);
  });
});

describe("buildPromptFamily", () => {
  it("produces a family whose prompts come from generated variants", () => {
    const family = buildPromptFamily({
      id: "clinic",
      topic: "Clinic bookkeeping",
      baseQuestion: "Who provides bookkeeping for medical clinics?",
      persona: "Practice manager",
      geography: "Australia",
      buyingStage: "decision",
      axes: { geographies: ["Australia"], personas: ["practice manager"] },
    });
    expect(family.prompts.length).toBeGreaterThan(1);
    expect(family.buyingStage).toBe("decision");
  });
});
