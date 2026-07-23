import { describe, expect, it } from "vitest";
import { buildPromptUniverse } from "@/lib/engines/prompt-universe";
import { isHallucinationPronePrompt } from "@/lib/engines/prompt-derive";

const base = { brandGuess: "DiligenceOS", domain: "dosacc.com" };

describe("buildPromptUniverse", () => {
  it("produces at least 20 unique prompts for three services", () => {
    const prompts = buildPromptUniverse({ ...base, services: ["bookkeeping", "tax preparation", "payroll"] });
    expect(prompts.length).toBeGreaterThanOrEqual(20);
    expect(new Set(prompts).size).toBe(prompts.length);
    expect(prompts.length).toBeLessThanOrEqual(40);
  });

  it("emits no bio-style prompts", () => {
    const prompts = buildPromptUniverse({ ...base, services: ["bookkeeping", "tax preparation"] });
    for (const p of prompts) expect(isHallucinationPronePrompt(p)).toBe(false);
  });

  it("includes brand-comparison prompts carrying the domain", () => {
    const prompts = buildPromptUniverse({ ...base, services: ["bookkeeping"] });
    expect(prompts.some((p) => p.includes("dosacc.com") && /vs alternatives/i.test(p))).toBe(true);
  });

  it("adds audience-specific prompts when audiences are given", () => {
    const prompts = buildPromptUniverse({
      ...base,
      services: ["bookkeeping"],
      audiences: ["CPA firms"],
    });
    expect(prompts.some((p) => /for CPA firms/i.test(p))).toBe(true);
  });

  it("falls back without throwing when services are empty", () => {
    const prompts = buildPromptUniverse({ ...base, services: [] });
    expect(prompts.length).toBeGreaterThanOrEqual(8);
    expect(prompts.some((p) => /professional services/i.test(p))).toBe(true);
  });

  it("returns at least 8 prompts for a single service", () => {
    expect(buildPromptUniverse({ ...base, services: ["bookkeeping"] }).length).toBeGreaterThanOrEqual(8);
  });
});
