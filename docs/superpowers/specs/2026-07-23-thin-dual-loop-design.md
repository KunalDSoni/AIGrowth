# Thin Dual Loop (SEO + GEO → Next Actions) — Design

**Date:** 2026-07-23  
**Status:** Approved in conversation; awaiting user review of this written spec  
**Product:** OpenGrowth AI Engine  
**Provider for GEO:** Google Gemini (`GEMINI_API_KEY`)

## 1. Problem

The workspace UI is largely complete, but the product loop is still demo-driven. Almost every page reads seeded “Northstar Accounting” data. The only strong live path is multi-page crawl → technical audit. That is not enough for an SEO + GEO AI product: users must paste a URL and see **their** evidence and ranked next actions.

## 2. Goal (this slice)

After a user pastes a public website URL:

1. Run a **real SEO crawl/audit** (existing multi-page scanner).
2. Run a **thin live GEO probe set** via Gemini (5–8 prompts derived from the crawl).
3. Persist a **Project** + run artifacts.
4. Merge both into one ranked **Next actions** queue with evidence IDs.
5. Show that queue as the primary dashboard content (no Northstar leakage in the primary view).

**Done when:** pasting e.g. `https://dosacc.com/` yields that site’s readiness score, GEO mention rate from live Gemini answers, and a mixed SEO+GEO Next actions list backed by non-simulated evidence.

## 3. Non-goals (explicit)

- Google Search Console / Analytics / keyword APIs
- Full competitor site crawls or backlink graphs
- Rewriting every secondary demo page into deep engines
- Billing, auth, multi-tenant orgs UI
- Broad chat assistant as a core path
- Claiming AI answers are stable rankings

## 4. Product loop

```text
URL
→ Project (domain, brandGuess, lastRunAt)
→ Job A: SEO scan (sitemap-driven crawl + live-audit + site aggregate)
→ Job B: GEO run (prompt derive → Gemini → extract mentions/citations)
→ Evidence store (CRAWL / TECHNICAL_SEO / AI_ANSWER / CITATION)
→ Recommendation bus (candidates → ranked Next actions)
→ Dashboard primary UI
```

Jobs A and B run **in parallel** after the homepage crawl has produced enough brand/service signals for prompt derivation. If homepage crawl fails, abort both with a clear error (do not run GEO on empty context).

## 5. Architecture

### 5.1 Modules (new or extended)

| Module | Responsibility |
|--------|----------------|
| `lib/projects/store.ts` | Create/update Project; load latest run bundle for a domain |
| `lib/engines/prompt-derive.ts` | From crawl signals → 5–8 GEO prompts |
| `lib/providers/gemini-visibility.ts` | Gemini adapter implementing AI visibility answer contract |
| `lib/engines/geo-extract.ts` | Parse mention/citations from Gemini text (deterministic heuristics + light structured output) |
| `app/api/analyze/route.ts` | Orchestrates SEO + GEO; returns unified payload |
| `lib/engines/next-actions.ts` | Maps SEO issues + GEO gaps → `RecommendationCandidate[]` → `rankCandidates` |
| Dashboard / `SiteScan` | Primary UI for analyze + Next actions |

Keep existing: `SafeWebsiteCrawler`, `live-audit`, `site-audit`, `sitemap`, `readiness`, `recommendation-bus`, `observation-run` shapes where compatible.

### 5.2 Gemini provider contract

```ts
interface AIVisibilityAnswerProvider {
  readonly name: "gemini";
  readonly model: string; // e.g. "gemini-2.0-flash" (pin in env GEMINI_MODEL with safe default)
  answer(prompt: string, opts: { timeoutMs: number }): Promise<{
    rawText: string;
    usage?: { promptTokens?: number; completionTokens?: number };
  }>;
}
```

- Auth: `process.env.GEMINI_API_KEY` required for live GEO. If missing → API returns `503` with `{ code: "GEMINI_NOT_CONFIGURED" }` for the GEO portion only if SEO-only mode is not requested; default analyze requires the key.
- Hard caps: max **8** prompts per run; **20s** timeout per prompt; concurrency **2**.
- Cost: estimate tokens from usage or char heuristic; store on the GEO run.
- Never log full API key; never send private/internal URLs (reuse SSRF guards from crawl).

### 5.3 Prompt derivation (thin)

From successful homepage (+ optional top pages) extract:

- `brandGuess`: `<title>` / `og:site_name` / hostname label
- `domain`: registrable host
- Up to 3 service phrases from H1 / title keywords (simple noun-phrase heuristics; no LLM required for derivation)

Generate prompts in this fixed template set (fill brand/service/domain):

1. `Who is {brand}?`
2. `Best {service} providers`
3. `Best {service} near me` (or market-neutral commercial variant if no geo signal)
4. `{brand} vs alternatives for {service}`
5. `Which company should I hire for {service}?`
6. Optional extras up to 8: second/third service variants

Always include the brand string for mention detection. Store exact prompt text on each observation.

### 5.4 Extraction

For each Gemini `rawText`:

- **Brand mentioned:** case-insensitive match on brandGuess and domain label (word-boundary where possible)
- **Citations:** extract `https?://` URLs; classify domain as `first-party` | `competitor-or-other` (first-party = same registrable domain as project)
- **Competitors mentioned:** optional weak heuristic (proper nouns near “vs”, “alternative”); if uncertain, leave empty — do not invent competitors

Reliability: `MEDIUM` for live Gemini observations; `isSimulated: false`; `isEstimated: false` for raw answer presence; citation classification may be `isEstimated: true` when unsure.

### 5.5 Next actions mapping

**From SEO (source: `technical`):**

- Top site-level and recurring page issues (critical/high first, then quick-wins)
- Title/action from existing audit issue fields
- Evidence: crawl + technical observation IDs
- Score components: severity-driven; effort low for meta/title; evidenceConfidence high for crawl-observed

**From GEO (source: `ai-visibility` / `citation`):**

- If brand mention rate &lt; 50% on commercial prompts → action: improve citeable first-party pages / entity clarity
- If first-party citation share = 0 while answers cite others → citation gap action
- Evidence: AI_ANSWER_OBSERVATION (+ CITATION_OBSERVATION) IDs
- Score: discoveryOpportunity high; evidenceConfidence medium; always include sample size in explanation

Invalid candidates (no evidenceIds) are rejected by the existing bus.

Cap displayed Next actions at **12** on the dashboard (full list available via API).

## 6. Persistence

Prisma already models `Project`, `AuditRun`, `AuditIssue`, `Recommendation`, `EvidenceReference`, `AIVisibilityObservation`, etc.

**Decision for this slice:**

1. Prefer **Prisma + PostgreSQL** when `DATABASE_URL` is set.
2. If `DATABASE_URL` is unset (local demo without Postgres), use a **file-backed project store** under `.data/projects/<domainHash>.json` with the **same TypeScript types** as the API response. Document that production requires Postgres.
3. Do not block the slice on multi-tenant auth; use a single default org/project owner id (`local-demo`) when auth is absent.

API must return the same JSON shape regardless of backend.

### 6.1 Run bundle shape (API)

```ts
interface AnalyzeResult {
  project: { id: string; domain: string; brandGuess: string; url: string };
  seo: { site: SiteSummary; pages: PageAudit[]; siteIssues: AuditIssue[]; scannedAt: string };
  geo: {
    runId: string;
    model: string;
    sampleSize: number;
    brandMentionRate: number; // 0–100
    firstPartyCitationShare: number; // 0–100
    observations: Array<{
      id: string;
      prompt: string;
      rawResponse: string;
      brandMentioned: boolean;
      citations: Array<{ url: string; domain: string; classification: "first-party" | "other" }>;
    }>;
    cost: { provider: "gemini"; estimatedUsd: number; tokens: number };
  };
  evidence: EvidenceReference[];
  nextActions: RankedCandidate[]; // from recommendation-bus
  guardrails: string[]; // always include GEO uncertainty copy
}
```

## 7. API

| Endpoint | Behavior |
|----------|----------|
| `POST /api/analyze` | Body `{ url: string }`. Validates with existing `publicWebsiteSchema`. Runs SEO+GEO. Persists. Returns `AnalyzeResult`. |
| `GET /api/analyze/latest?domain=` | Latest bundle for domain, or 404. |
| `POST /api/scan` | Keep working for SEO-only; optionally thin-wrap to call shared crawl helpers. Do not break existing SiteScan until migrated. |

Idempotency: same domain within 2 minutes may return cached latest run unless `?force=1` / `{ force: true }`.

Errors:

- Invalid / SSRF URL → 400
- Crawl failure → 502 with message
- Gemini missing key → 503 `GEMINI_NOT_CONFIGURED`
- Gemini partial failures → GEO observations include errors; still return SEO + partial GEO with `geo.errors[]`

## 8. UI

Primary surface: `/demo/dashboard` (and `SiteScan` or successor `ProjectAnalyze`).

1. URL input + Analyze button
2. KPI row: Growth readiness (SEO), Pages scanned, Brand mention rate (GEO), Next actions count
3. **Next actions** list (unified) with source badge `SEO` | `GEO`, evidence count, expand for why/measurement
4. Collapsible: SEO top issues / worst pages; GEO observations
5. Sample Northstar block: only under explicit “Sample demo data” disclosure, default collapsed/hidden when a live project exists

Secondary pages stay as-is for this slice (may still show demo); do not pretend they are live.

## 9. Security & compliance

- Reuse SSRF protections for all fetches
- Cap crawl pages (existing MAX_PAGES) and GEO prompts (8)
- Store Gemini responses as user/site intelligence; do not exfiltrate to third parties beyond Gemini
- Env: `GEMINI_API_KEY`, optional `GEMINI_MODEL`, `DATABASE_URL`

## 10. Testing

- Unit: prompt-derive, geo-extract, next-actions mapping, caps
- Unit: Gemini provider with mocked fetch (no network in CI)
- Integration: `/api/analyze` with mocked crawler + mocked Gemini → ranked actions include both sources
- Regression: existing `/api/scan` and readiness/live-audit/site-audit tests stay green

## 11. Rollout phases (implementation order)

1. Types + file/Prisma store + `POST /api/analyze` SEO half (persist existing scan)
2. Prompt derive + Gemini provider + GEO half
3. next-actions merge + evidence records
4. Dashboard UI switch to analyze result
5. Gate: typecheck, lint, unit tests, manual dosacc.com verify with real key

## 12. Success metrics

- Live analyze on a public site completes with SEO score + GEO sampleSize ≥ 5 when key present
- Every Next action has ≥ 1 evidence id and non-empty measurement hint
- Primary dashboard does not show Northstar metrics for a live project
- CI passes without calling Gemini (mocks only)
