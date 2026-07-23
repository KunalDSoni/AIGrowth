# Thin Dual Loop (SEO + GEO → Next Actions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste a URL → live multi-page SEO scan + Gemini GEO probes → persist project → unified evidence-backed Next actions on `/demo/dashboard`.

**Architecture:** Extract shared SEO crawl into `lib/engines/run-seo-scan.ts`. Add file-backed project store (Prisma later when `DATABASE_URL` set). Add Gemini visibility provider + prompt derive + geo extract + next-actions mapper. New `POST /api/analyze` orchestrates both. Dashboard consumes analyze result as primary UI.

**Tech Stack:** Next.js 15, TypeScript, Zod, Vitest, Gemini REST (`generativelanguage.googleapis.com`), existing recommendation-bus / live-audit / site-audit.

**Spec:** `docs/superpowers/specs/2026-07-23-thin-dual-loop-design.md`

## Global Constraints

- Max 8 GEO prompts/run; Gemini concurrency 2; 20s timeout per prompt
- SSRF via existing `publicWebsiteSchema` / `SafeWebsiteCrawler`
- CI must never call Gemini (mock fetch in tests)
- `GEMINI_API_KEY` required for live GEO; model from `GEMINI_MODEL` default `gemini-2.0-flash`
- File store under `.data/projects/` when no Postgres; `.data/` gitignored
- Primary dashboard must not show Northstar KPIs when a live project exists
- Every Next action requires ≥1 evidenceId
- shadcn/ui only for new UI

## File map

| File | Role |
|------|------|
| `lib/analyze/types.ts` | `AnalyzeResult` and related DTOs |
| `lib/projects/store.ts` | save/load latest analyze bundle by domain |
| `lib/engines/run-seo-scan.ts` | shared SEO scan used by `/api/scan` and `/api/analyze` |
| `lib/engines/prompt-derive.ts` | brand/service → prompts |
| `lib/engines/geo-extract.ts` | mention + citation extraction |
| `lib/providers/gemini-visibility.ts` | Gemini HTTP adapter |
| `lib/engines/run-geo.ts` | run probes with caps |
| `lib/engines/next-actions.ts` | SEO+GEO → RecommendationCandidate[] → rank |
| `app/api/analyze/route.ts` | POST analyze + GET latest |
| `components/site-scan.tsx` / dashboard | wire to `/api/analyze` |
| `tests/unit/*.test.ts` | unit coverage |

---

### Task 1: Analyze types + file project store

**Files:**
- Create: `lib/analyze/types.ts`
- Create: `lib/projects/store.ts`
- Test: `tests/unit/project-store.test.ts`

**Produces:**
- `AnalyzeResult` interface matching the spec §6.1
- `saveAnalyzeResult(result)`, `loadLatestByDomain(domain)`, `domainKey(urlOrDomain)`

- [ ] **Step 1: Write failing tests for domainKey + round-trip save/load**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { domainKey, createFileProjectStore } from "@/lib/projects/store";

describe("domainKey", () => {
  it("normalizes host", () => {
    expect(domainKey("https://www.Dosacc.com/path")).toBe("dosacc.com");
  });
});

describe("file project store", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "og-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("saves and loads latest by domain", async () => {
    const store = createFileProjectStore(dir);
    const result = { project: { id: "p1", domain: "dosacc.com", brandGuess: "Dosacc", url: "https://dosacc.com/" }, /* minimal AnalyzeResult */ } as any;
    await store.save(result);
    const loaded = await store.loadLatest("dosacc.com");
    expect(loaded?.project.brandGuess).toBe("Dosacc");
  });
});
```

- [ ] **Step 2: Implement `lib/analyze/types.ts` and `lib/projects/store.ts`**
- [ ] **Step 3: Run `npx vitest run tests/unit/project-store.test.ts` — PASS**
- [ ] **Step 4: Commit** `feat(analyze): project file store + AnalyzeResult types`

---

### Task 2: Extract shared SEO scan runner

**Files:**
- Create: `lib/engines/run-seo-scan.ts`
- Modify: `app/api/scan/route.ts` to call it
- Test: reuse existing scan behavior via unit test on runner with mocked crawler if practical; otherwise keep route thin and test runner with fixture crawl objects

**Produces:**
- `runSeoScan(url: string, deps?: { crawler }): Promise<{ site, pages, siteIssues, home: CrawledPageEvidence, scannedAt }>`

- [ ] **Step 1: Move logic from `app/api/scan/route.ts` into `runSeoScan`**
- [ ] **Step 2: Route becomes validate → runSeoScan → JSON**
- [ ] **Step 3: `npm run typecheck` + existing unit tests PASS**
- [ ] **Step 4: Commit** `refactor(scan): extract runSeoScan for analyze reuse`

---

### Task 3: Prompt derive + geo extract (TDD)

**Files:**
- Create: `lib/engines/prompt-derive.ts`
- Create: `lib/engines/geo-extract.ts`
- Test: `tests/unit/prompt-derive.test.ts`, `tests/unit/geo-extract.test.ts`

**Produces:**
- `deriveGeoPrompts(input: { brandGuess: string; domain: string; services: string[] }): string[]` — length 5–8
- `extractBrandSignals(rawText: string, brandGuess: string, domain: string): { brandMentioned: boolean; citations: Array<{url,domain,classification}>; brandMentions: string[] }`

- [ ] **Step 1: Failing tests** — prompts include brand + service templates; extraction detects brand and classifies first-party URLs
- [ ] **Step 2: Implement**
- [ ] **Step 3: Vitest PASS**
- [ ] **Step 4: Commit** `feat(geo): prompt derive + mention/citation extract`

---

### Task 4: Gemini provider + run-geo

**Files:**
- Create: `lib/providers/gemini-visibility.ts`
- Create: `lib/engines/run-geo.ts`
- Test: `tests/unit/gemini-visibility.test.ts`, `tests/unit/run-geo.test.ts`

**Produces:**
- `GeminiVisibilityProvider` with `answer(prompt)` using fetch to Gemini generateContent
- `runGeoProbes({ brandGuess, domain, services, provider, maxPrompts?: number }): Promise<GeoRunResult>`
- Throws / returns coded error when `GEMINI_API_KEY` missing

- [ ] **Step 1: Mock global fetch in tests; assert request URL contains model + key query or header**
- [ ] **Step 2: Implement provider + runner with mapLimit concurrency 2, max 8 prompts**
- [ ] **Step 3: Vitest PASS without network**
- [ ] **Step 4: Commit** `feat(geo): Gemini visibility provider + probe runner`

---

### Task 5: next-actions mapper + analyze API

**Files:**
- Create: `lib/engines/next-actions.ts`
- Create: `app/api/analyze/route.ts`
- Create: `app/api/analyze/latest/route.ts` (or query on same route)
- Test: `tests/unit/next-actions.test.ts`

**Produces:**
- `buildNextActions({ seo, geo, evidence }): RankedCandidate[]`
- `POST /api/analyze` → full `AnalyzeResult`
- `GET /api/analyze/latest?domain=`

- [ ] **Step 1: Unit test** — critical SEO issue + zero brand mentions → both sources in ranked list with evidenceIds
- [ ] **Step 2: Implement mapper + API orchestration** (SEO + GEO parallel after home crawl signals available; GEO uses home title/services)
- [ ] **Step 3: Typecheck + vitest PASS**
- [ ] **Step 4: Commit** `feat(analyze): POST /api/analyze SEO+GEO → next actions`

---

### Task 6: Dashboard UI on analyze

**Files:**
- Modify: `components/site-scan.tsx` (or create `components/project-analyze.tsx` and swap in dashboard)
- Modify: `components/dashboard.tsx` if needed

**Produces:**
- Analyze button calls `/api/analyze`
- KPIs: readiness, pages, brand mention %, next actions count
- Unified Next actions list with SEO|GEO badges
- Sample demo section collapsed/hidden when live result present

- [ ] **Step 1: Wire UI**
- [ ] **Step 2: Manual smoke with GEMINI_API_KEY against dosacc.com**
- [ ] **Step 3: `npm run typecheck && npm run lint && npm run test && npm run build`**
- [ ] **Step 4: Commit + push** `feat(ui): dashboard dual-loop analyze results`

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Project persist | 1 |
| SEO scan reuse | 2 |
| Prompt derive 5–8 | 3 |
| Gemini GEO | 4 |
| Evidence + next actions | 5 |
| Dashboard primary UI | 6 |
| Caps / SSRF / mocks in CI | 3–5 |
| Keep `/api/scan` | 2 |

## Execution

User said **GO** — execute **inline** in this session (executing-plans style), task-by-task with commits.
