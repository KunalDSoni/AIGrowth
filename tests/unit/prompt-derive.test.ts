import { describe, it, expect } from "vitest";
import { deriveGeoPrompts, extractServicePhrases, guessBrandFromTitle } from "@/lib/engines/prompt-derive";
import { extractBrandSignals } from "@/lib/engines/geo-extract";

describe("prompt-derive", () => {
  it("guesses brand from title", () => {
    expect(guessBrandFromTitle("Dosacc | Accounting", "www.dosacc.com")).toBe("Dosacc");
  });

  it("derives 5–8 prompts including brand and service", () => {
    const prompts = deriveGeoPrompts({
      brandGuess: "Dosacc",
      domain: "dosacc.com",
      services: ["bookkeeping", "tax filing"],
    });
    expect(prompts.length).toBeGreaterThanOrEqual(5);
    expect(prompts.length).toBeLessThanOrEqual(8);
    expect(prompts.some((p) => p.includes("Dosacc"))).toBe(true);
    expect(prompts.some((p) => /bookkeeping/i.test(p))).toBe(true);
  });

  it("extracts service phrases from text", () => {
    const phrases = extractServicePhrases(["Professional bookkeeping services for clinics"]);
    expect(phrases.length).toBeGreaterThan(0);
  });
});

describe("geo-extract", () => {
  it("detects brand mentions and classifies first-party citations", () => {
    const result = extractBrandSignals(
      "Dosacc is a strong option. See https://dosacc.com/services and https://competitor.example/x",
      "Dosacc",
      "dosacc.com",
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.citations.some((c) => c.classification === "first-party")).toBe(true);
    expect(result.citations.some((c) => c.classification === "other")).toBe(true);
  });
});
