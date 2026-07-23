# Agentic MAB CRO Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Ship Thompson Sampling CRO + SDR lead audit pipeline + report artifacts with swappable stores.

**Architecture:** Domain engines under `lib/engines/*` and `lib/bandit/*`, file-backed stores under `.data/`, Next.js API routes, shadcn demo pages.

**Tech Stack:** TypeScript, Next.js App Router, Vitest, existing SafeWebsiteCrawler, optional Playwright PDF.

## Global Constraints

- No Maps HTML scraping; Places/Lighthouse are adapter stubs until keyed  
- shadcn/ui only for new UI  
- Do not claim edge &lt;20ms without measurement  
- Keep SSRF guards for all outbound fetches  

## Files

| File | Responsibility |
|---|---|
| `lib/bandit/thompson.ts` | Beta sampling + select/update |
| `lib/bandit/store.ts` | BanditStore memory/file |
| `lib/engines/sdr-lead-pipeline.ts` | Prospect enrich + flags |
| `lib/engines/audit-report.ts` | HTML/PDF report builder |
| `lib/storage/object-store.ts` | File object store |
| `app/api/bandit/*` | select + event |
| `app/api/sdr/*` | jobs |
| `app/api/reports/[id]/route.ts` | serve reports |
| `app/demo/bandit/page.tsx` | CRO UI |
| `app/demo/sdr/page.tsx` | SDR UI |
| `tests/unit/thompson-bandit.test.ts` | MAB tests |
| `tests/unit/sdr-lead-pipeline.test.ts` | SDR tests |

## Tasks

- [ ] Task 1: Thompson Sampling engine + store + unit tests  
- [ ] Task 2: Bandit API routes + sticky cookie  
- [ ] Task 3: SDR pipeline + audit report + object store + tests  
- [ ] Task 4: SDR/report APIs + demo UIs + sidebar + docs  
- [ ] Task 5: Verify typecheck/tests; commit; push  
