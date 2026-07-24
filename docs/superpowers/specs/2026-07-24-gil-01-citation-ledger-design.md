# GIL-01 — Per-prompt citation ledger — Design

**Date:** 2026-07-24
**Status:** Approved
**Product:** OpenGrowth AI Engine
**Slice:** GEO Influence Loop (`docs/slices/SLICE-GEO-INFLUENCE-LOOP.md`), Stage A, epic 1.

## Why

`GeoResult.observations` already carries per-prompt data (prompt, `brandMentioned`,
`citations[]` with `first-party | other` classification). But its only consumer,
`buildLiveCitationGaps`, `flatMap`s every observation into two aggregate actions and
throws away the per-prompt structure.

Every later stage of the Influence Loop needs to know, *for a specific prompt*: were we
absent, and who was cited instead? GIL-05 (the recommender) prescribes a fix per gap;
GIL-02 extracts features from the sources cited *for that prompt*; GIL-11 measures lift
*per prompt*. None of that is possible from the flattened aggregate. GIL-01 preserves the
per-prompt structure as a clean typed artifact — the data spine the loop hangs on.

It also resolves a conflation in today's code. The engine treats "brand named in text" and
"brand's domain cited" as one signal. They are different: a **mention** is visibility, a
**first-party citation** is the authority signal GEO actually optimizes for. The ledger
separates them.

## Approach

**Pure derivation, no new store, no network.** `buildCitationLedger(geo)` reads the
already-persisted `GeoResult` and returns the ledger. Rebuilt on read — same philosophy as
the GIP compose module. Persistence of *interventions* is deliberately deferred to GIL-10;
GIL-01 introduces no storage.

`buildLiveCitationGaps` is **left untouched**. GIL-05 will eventually supersede it, but
GIL-01 does not refactor consumers — it only adds the new structure and its builder.

## Types

Added to `lib/analyze/types.ts`, adjacent to `GeoObservation` / `GeoCitation`:

```ts
export type PromptCitationStatus =
  | "cited"                // first-party citation present for this prompt
  | "mentioned-not-cited"  // brand named in text but no first-party citation
  | "absent"              // neither mention nor citation
  | "unanswered";          // probe errored or returned empty — excluded from all rates

export interface PromptCitationRecord {
  promptId: string;              // = GeoObservation.id
  prompt: string;
  status: PromptCitationStatus;
  brandMentioned: boolean;
  brandCited: boolean;           // a "first-party"-classified citation is present
  competitorDomains: string[];   // "other"-classified cited domains, deduped, this prompt
  citedSources: GeoCitation[];   // full cited list for this prompt (verbatim from probe)
}

export interface CitationLedger {
  runId: string;
  model: string;
  sampleSize: number;            // count of answered probes only
  records: PromptCitationRecord[]; // one per observation (including unanswered)
  competitorFrequency: { domain: string; count: number }[]; // desc; counted once per prompt
  coverage: {                    // counts across all records; sums to records.length
    cited: number;
    mentionedNotCited: number;
    absent: number;
    unanswered: number;
  };
  reliable: boolean;             // sampleSize >= MIN_SAMPLE
  evidenceIds: string[];
}
```

## Engine

New `lib/engines/geo-citation-ledger.ts`:

```ts
export function buildCitationLedger(
  geo: GeoResult,
  opts?: { evidenceIds?: string[] },
): CitationLedger;
```

Pure, deterministic, no I/O. Algorithm:

1. `MIN_SAMPLE = 3` (matches `live-citation-gaps`). Consider extracting to
   `scoring-constants.ts` if a second consumer needs it; inline for now.
2. For each observation, derive a `PromptCitationRecord`:
   - `unanswered` when `observation.error` is set **or** `rawResponse` is empty.
   - else `brandCited` = any citation classified `first-party`.
   - `status`: `cited` if `brandCited`; else `mentioned-not-cited` if `brandMentioned`;
     else `absent`.
   - `competitorDomains` = unique `other`-classified citation domains for this prompt.
3. `sampleSize` = count of records whose status is not `unanswered`.
4. `competitorFrequency`: for each answered record, take its **unique** competitor domains
   (so one answer linking a domain 3× counts once), tally across records, sort count desc
   then domain asc for determinism.
5. `coverage`: tally the four statuses; the four counts sum to `records.length`.
6. `reliable` = `sampleSize >= MIN_SAMPLE`.

## Honesty rules (enforced + tested)

- Unanswered probes are excluded from `sampleSize`, `competitorFrequency`, and every rate.
- A competitor domain is counted **once per prompt**, never per raw citation — one
  competitor spamming links in a single answer must not read as dominance.
- `reliable: false` when `sampleSize < MIN_SAMPLE`; the ledger surfaces the flag, never
  hides a thin sample. Downstream stages must honor it.
- No invented data: the builder only restructures what the probes returned. `citedSources`
  is verbatim.

## Scope boundaries (YAGNI)

Out of scope for GIL-01: persistence, API route, UI, competitor-page crawling (GIL-02),
feature extraction (GIL-02), gap diff (GIL-03), scoring/ranking/lift bands (GIL-05),
refactoring `buildLiveCitationGaps`. Just the types + one pure builder + tests.

## Testing

- brand-cited (first-party citation) → `status: "cited"`, `brandCited: true`.
- named but no first-party citation → `status: "mentioned-not-cited"`, `brandCited: false`.
- neither → `status: "absent"`.
- errored / empty-response probe → `status: "unanswered"`, excluded from `sampleSize` and
  `competitorFrequency`.
- per-prompt competitor dedup: an observation citing `a.com` twice contributes count 1.
- `competitorFrequency` ordered by count desc, then domain asc.
- `coverage` counts sum to `records.length`.
- empty / all-errored `geo` → `sampleSize: 0`, `reliable: false`, `records` present, no
  throw.
- `reliable` true iff `sampleSize >= 3`.
- builder is pure: same input → identical output; input `geo` not mutated.
