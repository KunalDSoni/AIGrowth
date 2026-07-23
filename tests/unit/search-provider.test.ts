import { describe, expect, it } from "vitest";
import {
  DemoSearchProvider,
  KeywordProviderAdapter,
  ProviderNotConfiguredError,
  SearchConsoleAdapter,
} from "@/lib/providers/search";

const input = { services: ["Bookkeeping", "Payroll"], audiences: ["Clinics"], market: "Australia" };

describe("DemoSearchProvider", () => {
  it("returns labelled, estimated signals for every service", async () => {
    const signals = await new DemoSearchProvider().discover(input);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => s.source === "demo" && s.isEstimated)).toBe(true);
    expect(signals.some((s) => s.service === "Bookkeeping")).toBe(true);
    expect(signals.some((s) => s.service === "Payroll")).toBe(true);
  });

  it("is deterministic across calls", async () => {
    const a = await new DemoSearchProvider().discover(input);
    const b = await new DemoSearchProvider().discover(input);
    expect(a).toEqual(b);
  });

  it("produces bounded volume and competition estimates", async () => {
    const signals = await new DemoSearchProvider().discover(input);
    for (const s of signals) {
      expect(s.monthlySearches!).toBeGreaterThanOrEqual(50);
      expect(s.competitionIndex!).toBeGreaterThanOrEqual(0);
      expect(s.competitionIndex!).toBeLessThan(100);
    }
  });
});

describe("placeholder adapters", () => {
  it("Search Console adapter fails fast with NOT_CONFIGURED", async () => {
    await expect(new SearchConsoleAdapter().discover()).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
  it("Keyword provider adapter fails fast with NOT_CONFIGURED", async () => {
    await expect(new KeywordProviderAdapter().discover()).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });
});
