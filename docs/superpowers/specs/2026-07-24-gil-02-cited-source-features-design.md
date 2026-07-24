# GIL-02 — Cited-source feature extraction — Design

**Date:** 2026-07-24
**Status:** Approved
**Product:** OpenGrowth AI Engine
**Slice:** GEO Influence Loop (`docs/slices/SLICE-GEO-INFLUENCE-LOOP.md`), Stage A, epic 2.

## Why

GIL-01 tells us *which competitor sources* were cited for each prompt where the brand was
absent. To prescribe a fix (GIL-05) we must answer the next question: **what do those cited
pages have that makes them citable?** GIL-02 crawls the cited sources and extracts a
GEO *answer-fitness profile* — the concrete, answer-engine-relevant features (a direct
answer, FAQ structure, comparison content, structured pricing, freshness, proof, structured
data). GIL-03 diffs this profile against the brand's own pages; GIL-05 maps each missing
feature to a fix type.

The repo already extracts *general SEO* page features via `normalizeHtmlToCrawlEvidence`
(`hasStructuredData`, `hasClearCta`, `hasProofSignal`, headings, word count). It does **not**
extract the GEO-specific answer-fitness features an answer engine rewards. GIL-02 adds those.

## Approach

Reuse the existing **safe crawler** (`getWebsiteCrawler` / `SafeWebsiteCrawler`) — it is
SSRF-guarded (`isPrivateAddress`, `publicWebsiteSchema`), size-limited, redirect-aware, and
already the crawler `crawlCompetitorHomepage` uses. GIL-02 does not add a new fetch path.

Two units, mirroring GIL-01's pure-core + thin-orchestration discipline:

1. **Pure extractor** `extractAnswerFitness(html: string): AnswerFitnessFeatures` — heuristics
   over raw HTML/text. No network, deterministic, fully unit-testable.
2. **Orchestrator** `buildCitedSourceProfiles(ledger, opts): Promise<CitedSourceFeatureProfile[]>`
   — selects the top-N most-cited competitor URLs from the ledger, crawls each via an
   **injected** crawler, runs the extractor, and records unreachable/skipped sources
   honestly. The injected crawler makes it testable with a fake and offline by default.

## Types

New `lib/engines/geo-cited-source-features.ts`:

```ts
export interface AnswerFitnessFeatures {
  hasDirectAnswer: boolean;      // answer-first / definitional lead ("X is a ...", lead <p>)
  hasFaqStructure: boolean;      // FAQPage JSON-LD or repeated Q&A heading pattern
  hasComparisonContent: boolean; // "vs"/"compare"/comparison table
  hasStructuredPricing: boolean; // pricing signals ($, /mo, "pricing", PriceSpecification)
  hasFreshnessSignal: boolean;   // dateModified / "updated" / a recent 4-digit year
  hasStructuredData: boolean;    // application/ld+json present
  hasProofSignal: boolean;       // case study / testimonial / certified / trusted by
  wordCount: number;
}

export type CitedSourceCrawlStatus = "extracted" | "unreachable" | "skipped";

export interface CitedSourceFeatureProfile {
  url: string;
  domain: string;
  citedForPrompts: string[];     // promptIds (from the ledger) this source was cited for
  citationCount: number;         // how many answered prompts cited this domain
  crawlStatus: CitedSourceCrawlStatus;
  features?: AnswerFitnessFeatures; // present iff crawlStatus === "extracted"
  note?: string;                 // why unreachable/skipped — honest, never hidden
}
```

Orchestrator signature:

```ts
import type { CitationLedger } from "@/lib/analyze/types";

export interface CitedSourceCrawler {
  crawl(url: string): Promise<{ rawHtml?: string; finalUrl: string; statusCode: number }>;
}

export interface BuildCitedSourceProfilesOptions {
  crawler: CitedSourceCrawler;
  limit?: number; // default 5 — bound crawl cost to the top-cited sources
}

export function buildCitedSourceProfiles(
  ledger: CitationLedger,
  opts: BuildCitedSourceProfilesOptions,
): Promise<CitedSourceFeatureProfile[]>;
```

`SafeWebsiteCrawler` satisfies `CitedSourceCrawler` structurally (its crawl returns
`CrawledPageEvidence` which carries `rawHtml`, `finalUrl`, `statusCode`). Real callers pass
`getWebsiteCrawler()`; tests pass a fake.

## Feature heuristics (pure, documented, directional)

All are lower-cased-text / regex heuristics over the crawled HTML — directional signals, not
guarantees. Each is independently testable:

- **hasDirectAnswer** — a lead paragraph in a definitional/answer-first shape: the first
  `<p>` (or first 300 chars of visible text) matches `/\b(is|are|means|refers to)\b/` within
  the first ~40 words, OR an `<h1>`/`<h2>` phrased as a question with an immediately
  following paragraph.
- **hasFaqStructure** — `"FAQPage"` in a `application/ld+json` block, OR ≥ 2 headings ending
  in `?`.
- **hasComparisonContent** — `/\b(vs\.?|versus|compare[ds]?|comparison|alternative to)\b/`,
  OR a `<table>` whose header row contains a competitor-ish/"features" column.
- **hasStructuredPricing** — `"PriceSpecification"`/`"Offer"` in JSON-LD, OR
  `/\b(pricing|\$\d|\d+\s*\/\s*mo|per month|per year)\b/`.
- **hasFreshnessSignal** — `"dateModified"`/`"datePublished"` in JSON-LD, OR
  `/\b(updated|last reviewed|as of)\b/`, OR a 4-digit year within 1 of the current year.
- **hasStructuredData** — `/application\/ld\+json/i` (matches the existing crawler heuristic).
- **hasProofSignal** — reuse the existing pattern:
  `/\b(case stud|testimonial|review|certified|accredited|guarantee|clients? include|trusted by)\b/`.
- **wordCount** — visible-text word count (scripts/styles/tags stripped), same method as
  `normalizeHtmlToCrawlEvidence`.

`hasFreshnessSignal` takes an injectable `now: Date = new Date()` so the year check is
deterministic in tests.

## Orchestration algorithm

1. Rank cited competitor domains by `ledger.competitorFrequency` (already count-desc). Take
   the top `limit` (default 5).
2. For each selected domain, choose one representative cited URL: the first `citedSources`
   entry across the ledger records whose `domain` matches and `classification === "other"`.
   Collect `citedForPrompts` = promptIds of every record citing that domain;
   `citationCount` = that domain's frequency count.
3. Crawl the chosen URL via `opts.crawler`. On success with `rawHtml` and a 2xx status →
   `crawlStatus: "extracted"`, `features = extractAnswerFitness(rawHtml)`. On thrown error
   or non-2xx or missing `rawHtml` → `crawlStatus: "unreachable"`, `note` set, no features.
4. If the ledger has no competitor domains (nobody else cited) → return `[]`.
5. Crawl failures never throw out of `buildCitedSourceProfiles`; each is captured on its
   own profile.

## Honesty rules (enforced + tested)

- Only the top `limit` most-cited sources are crawled — bounded cost, and the profile records
  which were included (the rest are simply not profiled, not silently claimed clean).
- Unreachable sources are returned with `crawlStatus: "unreachable"` and a `note`, never
  dropped and never guessed.
- All features are directional heuristics; the extractor invents nothing — every `true`
  traces to a pattern actually present in the crawled HTML.
- The orchestrator does not mutate the input ledger.

## Scope boundaries (YAGNI)

Out of scope for GIL-02: the brand-page gap diff (GIL-03), fix-type mapping (GIL-04/05),
API route or UI, Lighthouse performance scoring (the readiness engine already covers that
separately; GIL-02 is about *content* answer-fitness), crawling more than one URL per domain,
and any persistence.

## Testing

**`extractAnswerFitness` (pure, no network):**
- direct-answer lead detected / not detected.
- FAQPage JSON-LD → `hasFaqStructure`; two `?` headings → `hasFaqStructure`; neither → false.
- comparison text and comparison table each → `hasComparisonContent`.
- `$`/`/mo`/`Offer` JSON-LD → `hasStructuredPricing`.
- `dateModified` and "updated" and current-year each → `hasFreshnessSignal`; an old year with
  no other signal → false (inject a fixed `now`).
- `application/ld+json` → `hasStructuredData`.
- proof pattern → `hasProofSignal`.
- `wordCount` strips scripts/styles/tags.
- an empty/featureless page → all booleans false, `wordCount: 0`.

**`buildCitedSourceProfiles` (injected fake crawler):**
- picks the top-`limit` domains by frequency; a 3-domain ledger with `limit: 2` profiles 2.
- `citedForPrompts` lists the promptIds that cited that domain; `citationCount` matches the
  frequency count.
- a fake crawler returning HTML → `crawlStatus: "extracted"` with features.
- a fake crawler throwing → `crawlStatus: "unreachable"`, `note` present, no features, no
  throw out of the orchestrator.
- a fake crawler returning a 404 / no rawHtml → `unreachable`.
- an empty ledger (no competitor domains) → `[]`.
- input ledger not mutated.
