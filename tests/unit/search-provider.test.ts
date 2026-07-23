import { describe, expect, it, vi } from "vitest";
import {
  DemoSearchProvider,
  getSearchOpportunityProvider,
  isKeywordProviderConfigured,
  isSearchConsoleConfigured,
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

describe("SearchConsoleAdapter", () => {
  it("fails fast with NOT_CONFIGURED when credentials are missing", async () => {
    await expect(new SearchConsoleAdapter({ siteUrl: "", accessToken: "" }).discover(input)).rejects.toBeInstanceOf(
      ProviderNotConfiguredError,
    );
  });

  it("maps Search Analytics rows into labelled demand signals", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          rows: [
            { keys: ["bookkeeping for clinics"], clicks: 12, impressions: 400, position: 8.2 },
            { keys: ["payroll australia"], clicks: 4, impressions: 120, position: 18 },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const signals = await new SearchConsoleAdapter({
      siteUrl: "https://example.com/",
      accessToken: "token",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => new Date("2026-07-23T00:00:00.000Z"),
    }).discover(input);

    expect(signals).toHaveLength(2);
    expect(signals[0]).toMatchObject({
      query: "bookkeeping for clinics",
      source: "search-console",
      isEstimated: false,
      service: "Bookkeeping",
      monthlySearches: 100,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: "Bearer token" });
  });
});

describe("KeywordProviderAdapter", () => {
  it("fails fast with NOT_CONFIGURED when endpoint is missing", async () => {
    await expect(new KeywordProviderAdapter({ endpointUrl: "" }).discover(input)).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
  });

  it("posts discover input and normalizes provider JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          signals: [
            { keyword: "payroll software australia", volume: 880, competition: 62, service: "Payroll" },
            { query: "bookkeeping for clinics", monthlySearches: 700, competitionIndex: 41 },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const signals = await new KeywordProviderAdapter({
      endpointUrl: "https://keywords.example/v1/discover",
      apiKey: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).discover(input);

    expect(signals).toEqual([
      {
        query: "payroll software australia",
        topic: "Payroll",
        service: "Payroll",
        source: "keyword-provider",
        isEstimated: true,
        monthlySearches: 880,
        competitionIndex: 62,
      },
      {
        query: "bookkeeping for clinics",
        topic: "Bookkeeping",
        service: "Bookkeeping",
        source: "keyword-provider",
        isEstimated: true,
        monthlySearches: 700,
        competitionIndex: 41,
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("getSearchOpportunityProvider", () => {
  it("defaults to demo when nothing is configured", () => {
    const provider = getSearchOpportunityProvider({ OPENGROWTH_SEARCH_PROVIDER: "auto" });
    expect(provider.source).toBe("demo");
  });

  it("prefers Search Console in auto mode when configured", () => {
    const env = { OPENGROWTH_SEARCH_PROVIDER: "auto", GSC_SITE_URL: "https://x.com/", GSC_ACCESS_TOKEN: "t" };
    expect(isSearchConsoleConfigured(env)).toBe(true);
    expect(getSearchOpportunityProvider(env).source).toBe("search-console");
  });

  it("falls back to keyword provider when only keyword URL is set", () => {
    const env = { OPENGROWTH_SEARCH_PROVIDER: "auto", KEYWORD_PROVIDER_URL: "https://kw.example/" };
    expect(isKeywordProviderConfigured(env)).toBe(true);
    expect(getSearchOpportunityProvider(env).source).toBe("keyword-provider");
  });
});
