# GIL-02 Cited-source Feature Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crawl the competitor sources the GIL-01 ledger says beat us and extract a GEO answer-fitness profile per source.

**Architecture:** One new engine module `lib/engines/geo-cited-source-features.ts` with a pure HTML heuristic extractor (`extractAnswerFitness`) and a thin orchestrator (`buildCitedSourceProfiles`) that ranks the top-cited competitor domains from a `CitationLedger`, crawls one representative URL each via an injected crawler, and records unreachable sources honestly. Reuses the existing safe crawler; no new fetch path, no persistence.

**Tech Stack:** TypeScript, Vitest, `@/` alias.

## Global Constraints

- Test: `npm test` (`vitest run`). Typecheck: `npm run typecheck`. Lint: `npm run lint`.
- `@/` import alias; unit tests in `tests/unit/<name>.test.ts` importing from `vitest`.
- Reuse the existing safe crawler surface via a structural `CitedSourceCrawler` interface; do not import Node fetch directly.
- Honesty: only the top-`limit` sources crawled; unreachable sources returned with `crawlStatus: "unreachable"` + `note`, never dropped or guessed; every feature `true` traces to a pattern present in the crawled HTML; orchestrator never mutates the ledger and never throws on a crawl failure.
- Consumes GIL-01 output: `CitationLedger` from `@/lib/analyze/types` with `competitorFrequency: { domain; count }[]` (count-desc) and `records[].{ promptId, citedSources: { url, domain, classification }[] }`.

---

### Task 1: Pure answer-fitness extractor

**Files:**
- Create: `lib/engines/geo-cited-source-features.ts`
- Test: `tests/unit/geo-cited-source-features.test.ts`

**Interfaces:**
- Consumes: nothing external — pure over a string.
- Produces:
  - `interface AnswerFitnessFeatures { hasDirectAnswer: boolean; hasFaqStructure: boolean; hasComparisonContent: boolean; hasStructuredPricing: boolean; hasFreshnessSignal: boolean; hasStructuredData: boolean; hasProofSignal: boolean; wordCount: number }`
  - `function extractAnswerFitness(html: string, now?: Date): AnswerFitnessFeatures`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/geo-cited-source-features.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractAnswerFitness } from "@/lib/engines/geo-cited-source-features";

const FIXED_NOW = new Date("2026-07-24T00:00:00Z");

describe("extractAnswerFitness", () => {
  it("detects a definitional answer-first lead", () => {
    const html = "<p>Payroll outsourcing is a service where a provider runs payroll for you.</p>";
    expect(extractAnswerFitness(html, FIXED_NOW).hasDirectAnswer).toBe(true);
  });

  it("detects FAQ structure from FAQPage json-ld", () => {
    const html = `<script type="application/ld+json">{"@type":"FAQPage"}</script>`;
    expect(extractAnswerFitness(html, FIXED_NOW).hasFaqStructure).toBe(true);
  });

  it("detects FAQ structure from two question headings", () => {
    const html = "<h2>What is it?</h2><p>x</p><h2>How much does it cost?</h2><p>y</p>";
    expect(extractAnswerFitness(html, FIXED_NOW).hasFaqStructure).toBe(true);
  });

  it("detects comparison content from text and from a table", () => {
    expect(extractAnswerFitness("<p>Acme vs Globex compared</p>", FIXED_NOW).hasComparisonContent).toBe(true);
    expect(
      extractAnswerFitness("<table><tr><th>Features</th><th>Us</th></tr></table>", FIXED_NOW).hasComparisonContent,
    ).toBe(true);
  });

  it("detects structured pricing from a price and from Offer json-ld", () => {
    expect(extractAnswerFitness("<p>Plans from $49/mo</p>", FIXED_NOW).hasStructuredPricing).toBe(true);
    expect(
      extractAnswerFitness(`<script type="application/ld+json">{"@type":"Offer"}</script>`, FIXED_NOW)
        .hasStructuredPricing,
    ).toBe(true);
  });

  it("detects freshness from dateModified, from 'updated', and from the current year", () => {
    expect(extractAnswerFitness(`<script>{"dateModified":"2020-01-01"}</script>`, FIXED_NOW).hasFreshnessSignal).toBe(true);
    expect(extractAnswerFitness("<p>Last updated recently</p>", FIXED_NOW).hasFreshnessSignal).toBe(true);
    expect(extractAnswerFitness("<p>Guide for 2026</p>", FIXED_NOW).hasFreshnessSignal).toBe(true);
  });

  it("does not treat an old year alone as fresh", () => {
    expect(extractAnswerFitness("<p>Written in 2011.</p>", FIXED_NOW).hasFreshnessSignal).toBe(false);
  });

  it("detects structured data and proof signals", () => {
    const f = extractAnswerFitness(
      `<script type="application/ld+json">{"@type":"Organization"}</script><p>Trusted by 200 clients</p>`,
      FIXED_NOW,
    );
    expect(f.hasStructuredData).toBe(true);
    expect(f.hasProofSignal).toBe(true);
  });

  it("counts visible words and strips scripts/styles/tags", () => {
    const html = "<style>.a{color:red}</style><script>var x=1</script><p>one two three</p>";
    expect(extractAnswerFitness(html, FIXED_NOW).wordCount).toBe(3);
  });

  it("returns all-false and zero words for an empty page", () => {
    const f = extractAnswerFitness("", FIXED_NOW);
    expect(f).toEqual({
      hasDirectAnswer: false,
      hasFaqStructure: false,
      hasComparisonContent: false,
      hasStructuredPricing: false,
      hasFreshnessSignal: false,
      hasStructuredData: false,
      hasProofSignal: false,
      wordCount: 0,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- geo-cited-source-features`
Expected: FAIL — module not found / `extractAnswerFitness` not exported.

- [ ] **Step 3: Write the extractor**

Create `lib/engines/geo-cited-source-features.ts`:

```ts
export interface AnswerFitnessFeatures {
  hasDirectAnswer: boolean;
  hasFaqStructure: boolean;
  hasComparisonContent: boolean;
  hasStructuredPricing: boolean;
  hasFreshnessSignal: boolean;
  hasStructuredData: boolean;
  hasProofSignal: boolean;
  wordCount: number;
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractAnswerFitness(html: string, now: Date = new Date()): AnswerFitnessFeatures {
  const text = visibleText(html);
  const lower = text.toLowerCase();
  const htmlLower = html.toLowerCase();

  const leadWords = text.split(/\s+/).slice(0, 40).join(" ");
  const questionHeadings = [...html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)].filter((m) =>
    m[1].replace(/<[^>]+>/g, " ").trim().endsWith("?"),
  ).length;

  const hasDirectAnswer =
    /\b(is|are|means|refers to)\b/i.test(leadWords) && text.length > 0 && leadWords.trim().split(/\s+/).length >= 3;

  const hasFaqStructure = /"faqpage"/i.test(html) || questionHeadings >= 2;

  const hasComparisonContent =
    /\b(vs\.?|versus|compared?|comparison|alternative to)\b/i.test(lower) ||
    /<th[^>]*>\s*(features?|us|vs)\b/i.test(htmlLower);

  const hasStructuredPricing =
    /"(pricespecification|offer)"/i.test(html) ||
    /\b(pricing|per month|per year)\b/i.test(lower) ||
    /\$\d/.test(text) ||
    /\d+\s*\/\s*mo\b/i.test(lower);

  const currentYear = now.getUTCFullYear();
  const yearFresh = new RegExp(`\\b(${currentYear}|${currentYear - 1})\\b`).test(text);
  const hasFreshnessSignal =
    /"date(modified|published)"/i.test(html) || /\b(updated|last reviewed|as of)\b/i.test(lower) || yearFresh;

  const hasStructuredData = /application\/ld\+json/i.test(html);

  const hasProofSignal =
    /\b(case stud|testimonial|review|certified|accredited|guarantee|clients? include|trusted by)\b/i.test(lower);

  const wordCount = text ? text.split(/\s+/).length : 0;

  return {
    hasDirectAnswer,
    hasFaqStructure,
    hasComparisonContent,
    hasStructuredPricing,
    hasFreshnessSignal,
    hasStructuredData,
    hasProofSignal,
    wordCount,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- geo-cited-source-features`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/engines/geo-cited-source-features.ts tests/unit/geo-cited-source-features.test.ts
git commit -m "feat(geo): answer-fitness feature extractor (GIL-02 part 1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Cited-source profile orchestrator

**Files:**
- Modify: `lib/engines/geo-cited-source-features.ts` (append)
- Test: `tests/unit/geo-cited-source-features.test.ts` (append)

**Interfaces:**
- Consumes: `CitationLedger` from `@/lib/analyze/types`; `extractAnswerFitness` from Task 1.
- Produces:
  - `type CitedSourceCrawlStatus = "extracted" | "unreachable" | "skipped"`
  - `interface CitedSourceFeatureProfile { url: string; domain: string; citedForPrompts: string[]; citationCount: number; crawlStatus: CitedSourceCrawlStatus; features?: AnswerFitnessFeatures; note?: string }`
  - `interface CitedSourceCrawler { crawl(url: string): Promise<{ rawHtml?: string; finalUrl: string; statusCode: number }> }`
  - `interface BuildCitedSourceProfilesOptions { crawler: CitedSourceCrawler; limit?: number }`
  - `function buildCitedSourceProfiles(ledger: CitationLedger, opts: BuildCitedSourceProfilesOptions): Promise<CitedSourceFeatureProfile[]>`

- [ ] **Step 1: Write the failing test (append to the same test file)**

```ts
import { buildCitedSourceProfiles, type CitedSourceCrawler } from "@/lib/engines/geo-cited-source-features";
import type { CitationLedger, PromptCitationRecord } from "@/lib/analyze/types";

function record(promptId: string, others: string[]): PromptCitationRecord {
  return {
    promptId,
    prompt: promptId,
    status: "absent",
    brandMentioned: false,
    brandCited: false,
    competitorDomains: others,
    citedSources: others.map((d) => ({ url: `https://${d}/page`, domain: d, classification: "other" as const })),
  };
}

function ledgerOf(records: PromptCitationRecord[]): CitationLedger {
  const freq = new Map<string, number>();
  for (const r of records) for (const d of r.competitorDomains) freq.set(d, (freq.get(d) ?? 0) + 1);
  return {
    runId: "run-1",
    model: "fake",
    sampleSize: records.length,
    records,
    competitorFrequency: [...freq.entries()]
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain)),
    coverage: { cited: 0, mentionedNotCited: 0, absent: records.length, unanswered: 0 },
    reliable: true,
    evidenceIds: [],
  };
}

function fakeCrawler(fn: (url: string) => { rawHtml?: string; finalUrl?: string; statusCode?: number } | Error): CitedSourceCrawler {
  return {
    async crawl(url: string) {
      const out = fn(url);
      if (out instanceof Error) throw out;
      return { rawHtml: out.rawHtml, finalUrl: out.finalUrl ?? url, statusCode: out.statusCode ?? 200 };
    },
  };
}

describe("buildCitedSourceProfiles", () => {
  it("profiles the top-limit domains by citation frequency", async () => {
    const ledger = ledgerOf([record("p1", ["a.com", "b.com"]), record("p2", ["a.com"]), record("p3", ["c.com"])]);
    const profiles = await buildCitedSourceProfiles(ledger, {
      crawler: fakeCrawler(() => ({ rawHtml: "<p>Acme is a service. Plans from $9/mo</p>" })),
      limit: 2,
    });
    expect(profiles).toHaveLength(2);
    expect(profiles[0].domain).toBe("a.com");
    expect(profiles[0].citationCount).toBe(2);
    expect(profiles[0].citedForPrompts.sort()).toEqual(["p1", "p2"]);
    expect(profiles[0].crawlStatus).toBe("extracted");
    expect(profiles[0].features?.hasStructuredPricing).toBe(true);
  });

  it("marks a throwing crawl unreachable without throwing", async () => {
    const ledger = ledgerOf([record("p1", ["a.com"])]);
    const profiles = await buildCitedSourceProfiles(ledger, {
      crawler: fakeCrawler(() => new Error("blocked")),
    });
    expect(profiles[0].crawlStatus).toBe("unreachable");
    expect(profiles[0].note).toBeTruthy();
    expect(profiles[0].features).toBeUndefined();
  });

  it("marks a non-2xx or empty-body crawl unreachable", async () => {
    const ledger = ledgerOf([record("p1", ["a.com"])]);
    const profiles = await buildCitedSourceProfiles(ledger, {
      crawler: fakeCrawler(() => ({ statusCode: 404 })),
    });
    expect(profiles[0].crawlStatus).toBe("unreachable");
  });

  it("returns [] when no competitor domains were cited", async () => {
    const ledger = ledgerOf([record("p1", [])]);
    const profiles = await buildCitedSourceProfiles(ledger, { crawler: fakeCrawler(() => ({ rawHtml: "x" })) });
    expect(profiles).toEqual([]);
  });

  it("does not mutate the input ledger", async () => {
    const ledger = ledgerOf([record("p1", ["a.com"])]);
    const snapshot = JSON.stringify(ledger);
    await buildCitedSourceProfiles(ledger, { crawler: fakeCrawler(() => ({ rawHtml: "x" })) });
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- geo-cited-source-features`
Expected: FAIL — `buildCitedSourceProfiles` not exported.

- [ ] **Step 3: Append the orchestrator to `lib/engines/geo-cited-source-features.ts`**

```ts
import type { CitationLedger } from "@/lib/analyze/types";

export type CitedSourceCrawlStatus = "extracted" | "unreachable" | "skipped";

export interface CitedSourceFeatureProfile {
  url: string;
  domain: string;
  citedForPrompts: string[];
  citationCount: number;
  crawlStatus: CitedSourceCrawlStatus;
  features?: AnswerFitnessFeatures;
  note?: string;
}

export interface CitedSourceCrawler {
  crawl(url: string): Promise<{ rawHtml?: string; finalUrl: string; statusCode: number }>;
}

export interface BuildCitedSourceProfilesOptions {
  crawler: CitedSourceCrawler;
  limit?: number;
}

export async function buildCitedSourceProfiles(
  ledger: CitationLedger,
  opts: BuildCitedSourceProfilesOptions,
): Promise<CitedSourceFeatureProfile[]> {
  const limit = opts.limit ?? 5;
  const domains = ledger.competitorFrequency.slice(0, limit);

  const profiles: CitedSourceFeatureProfile[] = [];
  for (const { domain, count } of domains) {
    const source = ledger.records
      .flatMap((r) => r.citedSources)
      .find((c) => c.domain === domain && c.classification === "other");
    if (!source) continue;
    const citedForPrompts = ledger.records
      .filter((r) => r.citedSources.some((c) => c.domain === domain))
      .map((r) => r.promptId);

    const base = { url: source.url, domain, citedForPrompts, citationCount: count };
    try {
      const page = await opts.crawler.crawl(source.url);
      if (page.rawHtml && page.statusCode >= 200 && page.statusCode < 300) {
        profiles.push({ ...base, crawlStatus: "extracted", features: extractAnswerFitness(page.rawHtml) });
      } else {
        profiles.push({ ...base, crawlStatus: "unreachable", note: `HTTP ${page.statusCode} or empty body` });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "crawl failed";
      profiles.push({ ...base, crawlStatus: "unreachable", note: message });
    }
  }
  return profiles;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- geo-cited-source-features`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Typecheck, lint, full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass; no regressions.

- [ ] **Step 6: Commit**

```bash
git add lib/engines/geo-cited-source-features.ts tests/unit/geo-cited-source-features.test.ts
git commit -m "feat(geo): cited-source profile orchestrator (GIL-02 part 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** extractor + every heuristic (Task 1); orchestrator ranking/selection/crawl/unreachable/empty/no-mutation (Task 2). All spec test cases mapped. Out-of-scope items (GIL-03 diff, route/UI, Lighthouse, persistence) correctly absent.

**Placeholder scan:** none — every step has complete code or an exact command + expected result.

**Type consistency:** `AnswerFitnessFeatures`, `CitedSourceFeatureProfile`, `CitedSourceCrawler`, `BuildCitedSourceProfilesOptions`, `buildCitedSourceProfiles`, `extractAnswerFitness` names and fields identical across Interfaces blocks, tests, and implementation. `CitedSourceCrawler.crawl` return `{ rawHtml?, finalUrl, statusCode }` is structurally satisfied by `SafeWebsiteCrawler` (CrawledPageEvidence).
