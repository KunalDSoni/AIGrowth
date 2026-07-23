# Answer-Engine Prompt Universe — Design

**Date:** 2026-07-24
**Status:** Approved (user: "Scale answer-engine measurement (n=6 → 20+)")
**Product:** OpenGrowth AI Engine
**Slice:** Make the flagship answer-engine metric reliable by sampling a real prompt universe.

## Why

Sub-project 2 set the reliable sample threshold for the answer-engine mention
rate at **n ≥ 20**, and sub-project 3 put a gated `MetricStat` on the dashboard.
But `run-geo.ts` runs `MAX_PROMPTS = 6` derived from a thin template ("Best
{service} providers" and a few variants). So on every real scan the flagship
metric shows **"Insufficient sample — n=6, need 20"** — the honesty mechanism
correctly refusing to report an unreliable number.

The fix is the one lever that actually raises the sample: a **structured prompt
universe** of 20–40 real buyer-intent questions, so a scan that the provider
answers yields n ≥ 20 and the metric reports a real value with a tight interval.

Verified facts that shape scope:

- `run-geo.ts` already counts only *successful* probes as the sample
  (`sampleSize = answered.length`). Sample honesty is already correct.
- `GeminiVisibilityProvider.answer` already retries 429/5xx and transient
  network errors (2 retries, linear backoff). Execution resilience is adequate;
  the missing piece is prompt *breadth*.
- The DiligenceOS 429s were **quota exhaustion** (a hard daily cap), which no
  retry can fix. This design raises the sample the provider is *asked* for;
  actual `n` still depends on the API key's quota, and the metric will honestly
  gate when quota limits the successful count. That is correct behaviour, not a
  defect.

## The prompt universe

New `lib/engines/prompt-universe.ts`:

```ts
export interface PromptUniverseInput {
  brandGuess: string;
  domain: string;
  services: string[];
  audiences?: string[];
}

export function buildPromptUniverse(input: PromptUniverseInput): string[];
```

For up to 3 services × a fixed set of **intent families**, plus optional
audience enrichment and one brand-comparison prompt per service, deduplicated
and capped. Target: **20–40** prompts.

Intent families (generic buyer questions — never bio prompts, never invented
specifics):

1. `Best {service} providers`
2. `Best {service} companies to hire`
3. `Top {service} companies`
4. `Which company should I hire for {service}?`
5. `How do I choose a {service} provider?`
6. `What should I look for in a {service} provider?`
7. `How much does {service} cost?`
8. `Recommended {service} providers for small businesses`

Brand comparison (one per service, safe because the domain is given as identity,
matching the provider's system instruction): `{brand} ({domain}) vs alternatives
for {service}`.

Audience enrichment when `audiences` is present: `Best {service} providers for
{audience}` for the top 2 audiences × top 2 services.

**Guards (enforced and tested):**

- No bio-style prompts — `isHallucinationPronePrompt` (existing) rejects any
  "who is" / "what is" phrasing; the builder never emits them.
- No invented specifics: only `services` and `audiences` from the real profile
  are interpolated. Empty services fall back to `["professional services"]`
  exactly as `deriveGeoPrompts` does today.
- Deduplicated (case-insensitive) and capped at 40.

The existing `deriveGeoPrompts` stays for the thin/no-LLM path and its guard
export; `buildPromptUniverse` becomes the default for live sampling.

## Wiring

`run-geo.ts`:

- Default prompt source becomes `buildPromptUniverse` (was `deriveGeoPrompts`).
- `RunGeoInput` gains optional `audiences?: string[]`, threaded into the builder.
- `MAX_PROMPTS` raised to a **target of 24** (enough to clear n ≥ 20 with some
  provider failures); `CONCURRENCY` raised from 2 to 4 to keep wall-clock within
  the route's `maxDuration`.
- `provider` type loosened from the concrete `GeminiVisibilityProvider` to a
  structural interface `GeoAnswerProvider { model: string; answer(prompt, opts):
  Promise<{ rawText: string; usage?: {...} }> }`, so the sampling logic is
  testable with an injected fake provider. `GeminiVisibilityProvider` satisfies
  it structurally — real callers are unchanged.

Callers with audience signals thread them through:

- `app/api/analyze/route.ts` — pass `audiences` from the derived intelligence
  profile when available.
- `lib/agents/wiring.ts` (Observer probe) — pass `audiences: []` for now (the
  Onboarding agent supplies them later); the builder degrades to
  services-only.

## Error handling

- A prompt that fails after the provider's own retries is recorded with `error`
  and excluded from the sample — unchanged, honest.
- If **every** probe fails (e.g. quota exhausted), `sampleSize = 0`,
  `brandMentionRate = 0`, and the metric gates as "insufficient". The run does
  not throw.
- `buildPromptUniverse` with no services returns the same
  `["professional services"]`-based set as today, never an empty universe.

## Testing

- `buildPromptUniverse`: with 3 services returns ≥ 20 unique prompts; with 1
  service returns ≥ 8; none match `isHallucinationPronePrompt`; audiences add
  audience-specific prompts; empty services falls back without throwing; output
  is deduplicated and ≤ 40.
- Brand-comparison prompts include the domain in parentheses.
- `run-geo` with an injected fake provider (always succeeds): a 24-prompt
  universe yields `sampleSize = 24` and a mention rate reflecting the fake's
  answers; the resulting metric via `geoMentionMetric` is **reliable** (not
  gated) at that n.
- `run-geo` with a fake provider that fails a third of prompts: `sampleSize`
  equals the successful count, and `errors` captures the rest — honest partial
  sampling.
- Existing `run-geo` behaviour (mention-rate math, first-party share) unchanged
  for the same observations.

## Honesty constraints

The sample is the count of prompts the provider actually answered — never the
number requested. The metric gates whenever that count is below the reliable
threshold, including when API quota is the limiter. No prompt invents company
specifics; the universe is generic buyer questions plus the real services and
audiences.
