# Three-Section Report Suite — Design

**Date:** 2026-07-24
**Status:** Design (approved for spec review)
**Author:** Kunal + Claude (brainstorming)

## Problem

OpenGrowth currently produces a single combined "Position Report" HTML artifact
(`app/demo/marketing/report/page.tsx`, backed by `MarketingWorkspace`) that fuses
SEO, GEO, and marketing improvisation into one document. Users — especially the
freelancer/agency persona — want **three distinct, independently-exportable
reports (SEO, GEO, Marketing)**, each downloadable as a polished, client-facing
PDF, so they can deliver just the slice a given stakeholder cares about.

The risk to avoid: fragmenting the product's core differentiator. OpenGrowth's
north star is an *integrated* loop ("diagnose SEO+GEO position → prescribe
marketing tactics"). Three siloed pipelines would make us look like the 15
competitors who already ship disconnected reports.

## Goals

- Three focused reports — **SEO**, **GEO**, **Marketing** — each exportable as its
  own PDF.
- A combined **"Full Position Report"** PDF that stitches all three, as the
  flagship client deliverable.
- Best-in-class, client-facing polish (cover page, brand header/footer, print CSS).
- Preserve the integrated loop: all three render from **one shared analysis**, so
  the Marketing report cites the same SEO+GEO evidence the diagnosis produced.
- Honor the product non-negotiables: no fake scores; weak evidence renders as
  "insufficient/directional"; estimates labelled as estimates.

## Non-Goals (v1)

- Partial / lazy-fill runs (design keeps the door open; see below).
- Per-tenant branding/logo customization (a stubbed slot only).
- Scheduled or emailed report delivery.
- Editable / WYSIWYG report authoring.

## Chosen Approach — "Three views on one spine"

Selected over (a) three fully independent flows and (b) SEO+GEO paired /
Marketing separate. The spine model keeps data cross-connected while still
letting a user export any single report.

**Run model (v1): full-always.** Every analysis run populates all three sections.
Chosen for shipping simplicity. **However**, the data model carries a per-section
`status` field from day one so switching to partial/lazy-fill later is a config
change, not a rewrite.

## Architecture

```
Analysis run (per domain)
        │
        ▼
   AnalysisSpine ─────────────── shared data object
        │  seo: {...}  geo: {...}  marketing: {...}
        │  each section: { status: ready | not_run | insufficient, data }
        ▼
   ReportBuilder × 3   (pure: spine slice → ReportModel)
        │
        ▼
   ReportModel × 3   (typed, presentation-agnostic)
        │
        ▼
   HTML template engine  (shared chrome: cover, header/footer, print CSS;
        │                 three section skins)
        ▼
   Headless Chromium (Playwright — already a dependency) → PDF
        │
        ▼
   Object store  (existing @/lib/storage/object-store)
        │
        ▼
   GET /api/reports/[id]   (existing route, serves the PDF blob)
```

### Components

1. **`AnalysisSpine`** (type + assembler)
   - Aggregates existing sources: audit/scan/analyze → `seo`; ai-visibility →
     `geo`; marketing workspace → `marketing`.
   - Each section: `{ status: "ready" | "not_run" | "insufficient", data }`.
   - Single source of truth; the three builders read from it, never re-crawl.

2. **`ReportBuilder` (×3: seo, geo, marketing)**
   - Pure function: `(spine) → ReportModel`. No I/O, no rendering.
   - Enforces evidence gating: sparse/low-confidence inputs produce
     `insufficient`/`directional` blocks rather than invented numbers.
   - Contents:
     - **SEO** — technical + on-page + content audit: crawl health,
       indexability, ranked Core issues, opportunity list.
     - **GEO** — AI visibility: citation share per engine, why-not-cited,
       answer gaps, prompt-universe coverage; estimates labelled.
     - **Marketing** — Position summary + ranked Next Best Actions / Campaign
       Packs / Fix-Publish-Promote-Measure plan, citing SEO+GEO evidence.

3. **`ReportModel`** — typed, presentation-agnostic document (title, meta,
   ordered sections of typed blocks: KPI row, chapter, list, table, callout,
   insufficient-evidence notice). Shared block vocabulary across all three
   reports so one template renders any of them.

4. **Template engine** — shared "report chrome" (cover page, running
   header/footer with domain + date, page-break-aware print CSS, web fonts,
   stubbed brand/logo slot) + a per-section theme. Renders a `ReportModel` (or an
   ordered list of them, for the bundle) to a single HTML string.

5. **PDF renderer** — headless Chromium via Playwright renders the HTML string to
   PDF (A4/Letter, print backgrounds on, header/footer templates). Stores the
   blob in the object store, returns an id.

6. **Combined "Full Position Report"** — the template engine accepts an ordered
   `[seoModel, geoModel, marketingModel]`, emits one HTML with a shared cover +
   section dividers → one PDF. Same pipeline, different input.

### UX

- A **Reports** panel on the analysis/marketing surface shows four actions:
  three section cards (SEO / GEO / Marketing) each with a status badge and a
  **Download PDF** button, plus a **Download Full Position Report** button.
- "Run only one" in v1 = choose which card to export; the plumbing supports true
  partial runs later without UI change.
- Generated PDFs open inline via the existing `/api/reports/[id]` route.

## Data Flow

1. User runs analysis on a domain → `AnalysisSpine` assembled (all sections).
2. User clicks a Download button → server invokes the matching `ReportBuilder`
   (or all three for the bundle) → `ReportModel(s)`.
3. Template engine → HTML → Chromium → PDF blob → object store → id.
4. Client navigates to `/api/reports/[id]` → PDF served inline / downloadable.

## Error Handling

- **Section not run / insufficient** — builder emits an explicit
  "insufficient evidence" block; PDF renders honestly, never fabricates. The UI
  badge reflects the same status.
- **Chromium render failure** — API returns a 5xx with a structured error; UI
  shows a retry affordance; no partial/corrupt blob is stored.
- **Missing spine** — Download buttons are disabled until an analysis exists;
  the report route returns 404 for unknown ids (already implemented).
- **Object-store write failure** — surfaced as a 5xx; nothing half-written is
  referenced.

## Testing Strategy

- **Unit** — each `ReportBuilder`: spine slice → `ReportModel`, covering the
  `ready`, `not_run`, and `insufficient` paths (assert no invented numbers on
  weak evidence).
- **Golden HTML** — one snapshot per report + the bundle, so template/chrome
  regressions are caught.
- **E2E (Playwright)** — generate each of the three PDFs and the bundle; assert
  each is a valid, non-empty `application/pdf` served by `/api/reports/[id]`.

## Open Questions

None blocking. Deferred by design: partial-run orchestration, per-tenant
branding, scheduled delivery.

## Future Extensions

- Flip full-always → partial/lazy-fill (data model already supports it).
- Per-tenant branding (logo, colors) via the stubbed brand slot.
- Scheduled/emailed delivery of the Full Position Report.
