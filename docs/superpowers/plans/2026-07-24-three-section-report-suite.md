# Three-Section Report Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce three independently-exportable, client-facing PDF reports (SEO, GEO, Marketing) plus a combined "Full Position Report" bundle, all rendered from one shared analysis spine.

**Architecture:** One shared `AnalysisSpine` (assembled server-side from the existing project store + marketing workspace) feeds three pure `ReportBuilder` functions that emit a typed, presentation-agnostic `ReportModel`. A shared HTML renderer turns one or many models into premium print HTML; a generator renders that HTML to PDF via headless Chromium (Playwright), storing the blob in the existing object store and serving it through the existing `/api/reports/[id]` route.

**Tech Stack:** TypeScript, Next.js App Router (route handlers, `runtime = "nodejs"`), Playwright (`chromium`, already a dependency), Vitest (jsdom), the existing `@/lib/storage/object-store` and `@/lib/projects/store`.

## Global Constraints

- Evidence gating (product non-negotiable): weak/absent data renders as an explicit `insufficient` block — never a fabricated score or number. Copied from spec: "no fake scores; weak evidence → 'insufficient/directional'; estimates labelled as estimates."
- Run model v1 = **full-always**, but every section carries a `status: "ready" | "not_run" | "insufficient"` field so partial-run is a later config flip, not a rewrite.
- Follow the existing PDF pattern in `lib/engines/audit-report.ts` exactly: `chromium.launch({ headless: true })` → `page.setContent(html, { waitUntil: "load" })` → `page.pdf({ format: "A4", printBackground: true })`, gated by `process.env.OPENGROWTH_PDF === "playwright"`, with graceful fallback to storing the HTML artifact.
- Object store contract: `getObjectStore().put({ body, contentType })` → `StoredObject` (`.url` is `/api/reports/<id>`). Do not add a new storage layer.
- Tests live in `tests/unit/**/*.test.ts`, run with `npm test` (`vitest run`, jsdom env, `@` alias to repo root). Data dirs are auto-isolated by `tests/setup/isolate-data-dir.ts`.
- All user-facing HTML must HTML-escape interpolated strings (reuse a local `esc` helper like the ones in `report-html.ts` / `audit-report.ts`).

---

### Task 1: Report model types + spine assembler

**Files:**
- Create: `lib/reports/types.ts`
- Create: `lib/reports/spine.ts`
- Test: `tests/unit/reports-spine.test.ts`

**Interfaces:**
- Consumes: `AnalyzeResult` (`@/lib/analyze/types`), `MarketingWorkspace` + `loadWorkspace` (`@/lib/marketing/workspace`), `getProjectStore`, `domainKey` (`@/lib/projects/store`).
- Produces:
  - `type SectionStatus = "ready" | "not_run" | "insufficient"`
  - `type ReportBlock` (discriminated union: `kpis | chapter | list | table | callout | insufficient`)
  - `interface ReportSection { id: string; title: string; blocks: ReportBlock[] }`
  - `interface ReportModel { slug: "seo" | "geo" | "marketing"; title: string; domain: string; brand: string; generatedAt: string; status: SectionStatus; sections: ReportSection[] }`
  - `interface AnalysisSpine { domain; brand; generatedAt; seo: SpineSection<AnalyzeResult["seo"]>; geo: SpineSection<AnalyzeResult["geo"]>; marketing: SpineSection<MarketingWorkspace> }` where `SpineSection<T> = { status: SectionStatus; data: T | null }`
  - `statusForSeo(a: AnalyzeResult | null): SectionStatus`
  - `statusForGeo(a: AnalyzeResult | null): SectionStatus`
  - `statusForMarketing(ws: MarketingWorkspace | null): SectionStatus`
  - `assembleSpineFrom(domain: string, analyze: AnalyzeResult | null, ws: MarketingWorkspace | null): AnalysisSpine`
  - `assembleSpine(domain: string): Promise<AnalysisSpine>`

- [ ] **Step 1: Write `lib/reports/types.ts`**

```typescript
/** Typed, presentation-agnostic report document shared by all three reports. */

export type SectionStatus = "ready" | "not_run" | "insufficient";

export type ReportBlock =
  | { kind: "kpis"; items: { label: string; value: string; hint?: string }[] }
  | { kind: "chapter"; title: string; body: string; bullets: string[] }
  | { kind: "list"; title: string; items: string[] }
  | { kind: "table"; title: string; columns: string[]; rows: string[][] }
  | { kind: "callout"; tone: "info" | "warn"; text: string }
  | { kind: "insufficient"; reason: string };

export interface ReportSection {
  id: string;
  title: string;
  blocks: ReportBlock[];
}

export interface ReportModel {
  slug: "seo" | "geo" | "marketing";
  title: string;
  domain: string;
  brand: string;
  generatedAt: string;
  status: SectionStatus;
  sections: ReportSection[];
}
```

- [ ] **Step 2: Write the failing spine test**

```typescript
// tests/unit/reports-spine.test.ts
import { describe, expect, it } from "vitest";
import type { AnalyzeResult } from "@/lib/analyze/types";
import type { MarketingWorkspace } from "@/lib/marketing/workspace";
import {
  assembleSpineFrom,
  statusForGeo,
  statusForMarketing,
  statusForSeo,
} from "@/lib/reports/spine";

function analyzeFixture(over: Partial<AnalyzeResult> = {}): AnalyzeResult {
  return {
    project: { id: "p1", domain: "acme.com", brandGuess: "Acme", url: "https://acme.com" },
    seo: {
      site: { score: 72, band: "solid", pagesScanned: 12, pagesFailed: 0, totalIssues: 5, critical: 1, high: 2, quickWins: 3, monitors: 0, worstPages: [], topIssues: [] },
      pages: [{}, {}] as never,
      siteIssues: [],
      scannedAt: "2026-07-24T00:00:00Z",
      finalUrl: "https://acme.com",
      origin: "https://acme.com",
    },
    geo: { runId: "g1", model: "gemini", sampleSize: 20, brandMentionRate: 0.4, firstPartyCitationShare: 0.2, observations: [], errors: [], cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 } },
    evidence: [],
    nextActions: [],
    guardrails: [],
    analyzedAt: "2026-07-24T00:00:00Z",
    ...over,
  } as AnalyzeResult;
}

function wsFixture(): MarketingWorkspace {
  return {
    domain: "acme.com",
    brand: "Acme",
    source: "live",
    updatedAt: "2026-07-24T00:00:00Z",
    report: { id: "r1", brand: "Acme", domain: "acme.com", generatedAt: "2026-07-24T00:00:00Z", mode: "client", scoreboard: { seoReadiness: 72, geoMentionRate: 0.4, geoSampleSize: 20, competitorPressure: "medium", labels: [] }, chapters: [], improvisation: [], tactics: [], kpis: [] },
  } as unknown as MarketingWorkspace;
}

describe("spine status", () => {
  it("marks SEO ready when pages exist", () => {
    expect(statusForSeo(analyzeFixture())).toBe("ready");
  });
  it("marks SEO not_run when no analyze", () => {
    expect(statusForSeo(null)).toBe("not_run");
  });
  it("marks GEO insufficient below the sample floor", () => {
    expect(statusForGeo(analyzeFixture({ geo: { ...analyzeFixture().geo, sampleSize: 3 } }))).toBe("insufficient");
  });
  it("marks Marketing not_run without a workspace", () => {
    expect(statusForMarketing(null)).toBe("not_run");
  });
});

describe("assembleSpineFrom", () => {
  it("normalizes domain and carries per-section status + data", () => {
    const spine = assembleSpineFrom("https://www.Acme.com/", analyzeFixture(), wsFixture());
    expect(spine.domain).toBe("acme.com");
    expect(spine.brand).toBe("Acme");
    expect(spine.seo.status).toBe("ready");
    expect(spine.geo.status).toBe("ready");
    expect(spine.marketing.status).toBe("ready");
    expect(spine.seo.data).not.toBeNull();
  });
  it("is fully empty when nothing has been run", () => {
    const spine = assembleSpineFrom("acme.com", null, null);
    expect(spine.seo.status).toBe("not_run");
    expect(spine.geo.status).toBe("not_run");
    expect(spine.marketing.status).toBe("not_run");
    expect(spine.marketing.data).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tests/unit/reports-spine.test.ts`
Expected: FAIL — cannot resolve `@/lib/reports/spine`.

- [ ] **Step 4: Write `lib/reports/spine.ts`**

```typescript
/** Assembles the shared AnalysisSpine that all three report builders read. */

import type { AnalyzeResult } from "@/lib/analyze/types";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { loadWorkspace, type MarketingWorkspace } from "@/lib/marketing/workspace";
import type { SectionStatus } from "@/lib/reports/types";

/** GEO rates below this sample size are directional only. */
export const GEO_MIN_SAMPLE = 10;

export interface SpineSection<T> {
  status: SectionStatus;
  data: T | null;
}

export interface AnalysisSpine {
  domain: string;
  brand: string;
  generatedAt: string;
  seo: SpineSection<AnalyzeResult["seo"]>;
  geo: SpineSection<AnalyzeResult["geo"]>;
  marketing: SpineSection<MarketingWorkspace>;
}

export function statusForSeo(analyze: AnalyzeResult | null): SectionStatus {
  if (!analyze?.seo?.site) return "not_run";
  if ((analyze.seo.pages?.length ?? 0) === 0) return "insufficient";
  return "ready";
}

export function statusForGeo(analyze: AnalyzeResult | null): SectionStatus {
  if (!analyze?.geo) return "not_run";
  if ((analyze.geo.sampleSize ?? 0) < GEO_MIN_SAMPLE) return "insufficient";
  return "ready";
}

export function statusForMarketing(ws: MarketingWorkspace | null): SectionStatus {
  if (!ws?.report) return "not_run";
  return "ready";
}

export function assembleSpineFrom(
  domain: string,
  analyze: AnalyzeResult | null,
  ws: MarketingWorkspace | null,
): AnalysisSpine {
  const key = domainKey(domain);
  const brand = analyze?.project.brandGuess ?? ws?.brand ?? key;
  return {
    domain: key,
    brand,
    generatedAt: new Date().toISOString(),
    seo: { status: statusForSeo(analyze), data: analyze?.seo ?? null },
    geo: { status: statusForGeo(analyze), data: analyze?.geo ?? null },
    marketing: { status: statusForMarketing(ws), data: ws ?? null },
  };
}

export async function assembleSpine(domain: string): Promise<AnalysisSpine> {
  const analyze = await getProjectStore().loadLatest(domainKey(domain));
  const ws = await loadWorkspace(domain);
  return assembleSpineFrom(domain, analyze, ws);
}
```

Note: if `MarketingWorkspace` is not exported from `@/lib/marketing/workspace`, import the type from there where it is declared (it is declared and exported in `lib/marketing/workspace.ts`).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/unit/reports-spine.test.ts`
Expected: PASS (8 assertions).

- [ ] **Step 6: Commit**

```bash
git add lib/reports/types.ts lib/reports/spine.ts tests/unit/reports-spine.test.ts
git commit -m "feat(reports): report model types + shared analysis spine

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: SEO report builder

**Files:**
- Create: `lib/reports/builders/seo.ts`
- Test: `tests/unit/reports-builder-seo.test.ts`

**Interfaces:**
- Consumes: `AnalysisSpine` (Task 1), `ReportModel`/`ReportBlock` (Task 1), `AuditIssue` fields (`id, ruleId, severity, title, description, recommendedAction, affectedPages`), `SiteSummary` fields (`score, band, pagesScanned, totalIssues, critical, high`).
- Produces: `buildSeoReport(spine: AnalysisSpine): ReportModel` (slug `"seo"`).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/reports-builder-seo.test.ts
import { describe, expect, it } from "vitest";
import { assembleSpineFrom } from "@/lib/reports/spine";
import { buildSeoReport } from "@/lib/reports/builders/seo";
import type { AnalyzeResult } from "@/lib/analyze/types";

function analyze(pages: number): AnalyzeResult {
  return {
    project: { id: "p", domain: "acme.com", brandGuess: "Acme", url: "https://acme.com" },
    seo: {
      site: { score: 72, band: "solid", pagesScanned: pages, pagesFailed: 0, totalIssues: 1, critical: 0, high: 1, quickWins: 0, monitors: 0, worstPages: [], topIssues: [] },
      pages: Array.from({ length: pages }, () => ({})) as never,
      siteIssues: [
        { id: "i1", ruleId: "meta.title.missing", category: "metadata", severity: "high", title: "Missing title tags", description: "3 pages lack titles", recommendedAction: "Add unique titles", affectedPages: 3, evidenceIds: [], impactArea: "metadata" },
      ] as never,
      scannedAt: "2026-07-24T00:00:00Z", finalUrl: "https://acme.com", origin: "https://acme.com",
    },
    geo: { runId: "g", model: "gemini", sampleSize: 20, brandMentionRate: 0, firstPartyCitationShare: 0, observations: [], errors: [], cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 } },
    evidence: [], nextActions: [], guardrails: [], analyzedAt: "2026-07-24T00:00:00Z",
  } as AnalyzeResult;
}

describe("buildSeoReport", () => {
  it("emits KPIs and a ranked issues table when data is ready", () => {
    const model = buildSeoReport(assembleSpineFrom("acme.com", analyze(12), null));
    expect(model.slug).toBe("seo");
    expect(model.status).toBe("ready");
    const kinds = model.sections.flatMap((s) => s.blocks.map((b) => b.kind));
    expect(kinds).toContain("kpis");
    expect(kinds).toContain("table");
  });

  it("emits only an insufficient block when SEO has not run", () => {
    const model = buildSeoReport(assembleSpineFrom("acme.com", null, null));
    expect(model.status).toBe("not_run");
    const kinds = model.sections.flatMap((s) => s.blocks.map((b) => b.kind));
    expect(kinds).toEqual(["insufficient"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/reports-builder-seo.test.ts`
Expected: FAIL — cannot resolve `@/lib/reports/builders/seo`.

- [ ] **Step 3: Write `lib/reports/builders/seo.ts`**

```typescript
import type { AnalysisSpine } from "@/lib/reports/spine";
import type { ReportBlock, ReportModel } from "@/lib/reports/types";

export function buildSeoReport(spine: AnalysisSpine): ReportModel {
  const base = {
    slug: "seo" as const,
    title: "SEO Report",
    domain: spine.domain,
    brand: spine.brand,
    generatedAt: spine.generatedAt,
    status: spine.seo.status,
  };

  const seo = spine.seo.data;
  if (!seo || spine.seo.status === "not_run") {
    return {
      ...base,
      sections: [
        {
          id: "seo-empty",
          title: "Technical & on-page audit",
          blocks: [{ kind: "insufficient", reason: "No SEO crawl has been run for this domain yet." }],
        },
      ],
    };
  }

  const blocks: ReportBlock[] = [];
  if (spine.seo.status === "insufficient") {
    blocks.push({ kind: "insufficient", reason: "Crawl returned no pages — findings below are directional only." });
  }
  blocks.push({
    kind: "kpis",
    items: [
      { label: "Readiness", value: String(seo.site.score), hint: seo.site.band },
      { label: "Pages scanned", value: String(seo.site.pagesScanned) },
      { label: "Critical / High", value: `${seo.site.critical} / ${seo.site.high}` },
      { label: "Total issues", value: String(seo.site.totalIssues) },
    ],
  });
  blocks.push({
    kind: "table",
    title: "Ranked issues",
    columns: ["Issue", "Severity", "Pages", "Recommended action"],
    rows: seo.siteIssues
      .slice(0, 25)
      .map((i) => [i.title, i.severity, String(i.affectedPages), i.recommendedAction]),
  });

  return { ...base, sections: [{ id: "seo-main", title: "Technical & on-page audit", blocks }] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/reports-builder-seo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/builders/seo.ts tests/unit/reports-builder-seo.test.ts
git commit -m "feat(reports): SEO report builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: GEO report builder

**Files:**
- Create: `lib/reports/builders/geo.ts`
- Test: `tests/unit/reports-builder-geo.test.ts`

**Interfaces:**
- Consumes: `AnalysisSpine` (Task 1); `GeoResult` fields (`sampleSize, brandMentionRate, firstPartyCitationShare, observations, errors`).
- Produces: `buildGeoReport(spine: AnalysisSpine): ReportModel` (slug `"geo"`). Rates rendered as percentages and always labelled with sample size.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/reports-builder-geo.test.ts
import { describe, expect, it } from "vitest";
import { assembleSpineFrom } from "@/lib/reports/spine";
import { buildGeoReport } from "@/lib/reports/builders/geo";
import type { AnalyzeResult } from "@/lib/analyze/types";

function analyze(sampleSize: number): AnalyzeResult {
  return {
    project: { id: "p", domain: "acme.com", brandGuess: "Acme", url: "https://acme.com" },
    seo: { site: { score: 0, band: "weak", pagesScanned: 0, pagesFailed: 0, totalIssues: 0, critical: 0, high: 0, quickWins: 0, monitors: 0, worstPages: [], topIssues: [] }, pages: [], siteIssues: [], scannedAt: "", finalUrl: "", origin: "" },
    geo: { runId: "g", model: "gemini", sampleSize, brandMentionRate: 0.4, firstPartyCitationShare: 0.25, observations: [], errors: [], cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 } },
    evidence: [], nextActions: [], guardrails: [], analyzedAt: "2026-07-24T00:00:00Z",
  } as AnalyzeResult;
}

describe("buildGeoReport", () => {
  it("labels rates with sample size when ready", () => {
    const model = buildGeoReport(assembleSpineFrom("acme.com", analyze(20), null));
    expect(model.slug).toBe("geo");
    expect(model.status).toBe("ready");
    const kpis = model.sections.flatMap((s) => s.blocks).find((b) => b.kind === "kpis");
    expect(kpis).toBeDefined();
    if (kpis?.kind === "kpis") {
      const mention = kpis.items.find((i) => i.label.toLowerCase().includes("mention"));
      expect(mention?.value).toContain("40");
      expect(mention?.hint).toContain("20");
    }
  });

  it("flags insufficient sample below the floor", () => {
    const model = buildGeoReport(assembleSpineFrom("acme.com", analyze(3), null));
    expect(model.status).toBe("insufficient");
    const kinds = model.sections.flatMap((s) => s.blocks.map((b) => b.kind));
    expect(kinds).toContain("insufficient");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/reports-builder-geo.test.ts`
Expected: FAIL — cannot resolve `@/lib/reports/builders/geo`.

- [ ] **Step 3: Write `lib/reports/builders/geo.ts`**

```typescript
import type { AnalysisSpine } from "@/lib/reports/spine";
import type { ReportBlock, ReportModel } from "@/lib/reports/types";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function buildGeoReport(spine: AnalysisSpine): ReportModel {
  const base = {
    slug: "geo" as const,
    title: "GEO Report",
    domain: spine.domain,
    brand: spine.brand,
    generatedAt: spine.generatedAt,
    status: spine.geo.status,
  };

  const geo = spine.geo.data;
  if (!geo || spine.geo.status === "not_run") {
    return {
      ...base,
      sections: [
        {
          id: "geo-empty",
          title: "AI answer-engine visibility",
          blocks: [{ kind: "insufficient", reason: "No answer-engine probes have been run for this domain yet." }],
        },
      ],
    };
  }

  const sampleHint = `n=${geo.sampleSize} probes`;
  const blocks: ReportBlock[] = [];
  if (spine.geo.status === "insufficient") {
    blocks.push({ kind: "insufficient", reason: `Only ${geo.sampleSize} probes — rates are directional, not reliable.` });
  }
  blocks.push({
    kind: "kpis",
    items: [
      { label: "Brand mention rate", value: pct(geo.brandMentionRate), hint: sampleHint },
      { label: "First-party citation share", value: pct(geo.firstPartyCitationShare), hint: sampleHint },
      { label: "Model", value: geo.model },
    ],
  });
  if (geo.errors.length > 0) {
    blocks.push({ kind: "callout", tone: "warn", text: `${geo.errors.length} probe(s) errored and were excluded from rates.` });
  }

  return { ...base, sections: [{ id: "geo-main", title: "AI answer-engine visibility", blocks }] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/reports-builder-geo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/builders/geo.ts tests/unit/reports-builder-geo.test.ts
git commit -m "feat(reports): GEO report builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Marketing report builder

**Files:**
- Create: `lib/reports/builders/marketing.ts`
- Test: `tests/unit/reports-builder-marketing.test.ts`

**Interfaces:**
- Consumes: `AnalysisSpine` (Task 1); `PositionReport` fields (`kpis: MarketingKpi[]`, `chapters: {title,body,bullets}[]`, `improvisation: ImprovisationStep[]` with `bucket,title,detail,effortHours`).
- Produces: `buildMarketingReport(spine: AnalysisSpine): ReportModel` (slug `"marketing"`).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/reports-builder-marketing.test.ts
import { describe, expect, it } from "vitest";
import { assembleSpineFrom } from "@/lib/reports/spine";
import { buildMarketingReport } from "@/lib/reports/builders/marketing";
import type { MarketingWorkspace } from "@/lib/marketing/workspace";

function ws(withReport: boolean): MarketingWorkspace | null {
  if (!withReport) return null;
  return {
    domain: "acme.com", brand: "Acme", source: "live", updatedAt: "",
    report: {
      id: "r", brand: "Acme", domain: "acme.com", generatedAt: "", mode: "client",
      scoreboard: { seoReadiness: 72, geoMentionRate: 0.4, geoSampleSize: 20, competitorPressure: "medium", labels: [] },
      chapters: [{ id: "c1", title: "Where you stand", body: "Solid technically.", bullets: ["Good speed"] }],
      improvisation: [{ id: "s1", bucket: "Fix", title: "Add titles", detail: "3 pages", effortHours: 2 }],
      tactics: [],
      kpis: [{ id: "k1", label: "Readiness", value: "72" }],
    },
  } as unknown as MarketingWorkspace;
}

describe("buildMarketingReport", () => {
  it("renders KPIs, chapters and the Fix/Publish/Promote/Measure plan", () => {
    const model = buildMarketingReport(assembleSpineFrom("acme.com", null, ws(true)));
    expect(model.slug).toBe("marketing");
    expect(model.status).toBe("ready");
    const kinds = model.sections.flatMap((s) => s.blocks.map((b) => b.kind));
    expect(kinds).toContain("kpis");
    expect(kinds).toContain("chapter");
    expect(kinds).toContain("table");
  });

  it("is insufficient with no workspace", () => {
    const model = buildMarketingReport(assembleSpineFrom("acme.com", null, ws(false)));
    expect(model.status).toBe("not_run");
    const kinds = model.sections.flatMap((s) => s.blocks.map((b) => b.kind));
    expect(kinds).toEqual(["insufficient"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/reports-builder-marketing.test.ts`
Expected: FAIL — cannot resolve `@/lib/reports/builders/marketing`.

- [ ] **Step 3: Write `lib/reports/builders/marketing.ts`**

```typescript
import type { AnalysisSpine } from "@/lib/reports/spine";
import type { ReportBlock, ReportModel, ReportSection } from "@/lib/reports/types";

export function buildMarketingReport(spine: AnalysisSpine): ReportModel {
  const base = {
    slug: "marketing" as const,
    title: "Marketing Report",
    domain: spine.domain,
    brand: spine.brand,
    generatedAt: spine.generatedAt,
    status: spine.marketing.status,
  };

  const ws = spine.marketing.data;
  if (!ws?.report || spine.marketing.status === "not_run") {
    return {
      ...base,
      sections: [
        {
          id: "mkt-empty",
          title: "Position & next best actions",
          blocks: [{ kind: "insufficient", reason: "No marketing workspace has been generated for this domain yet." }],
        },
      ],
    };
  }

  const report = ws.report;
  const summaryBlocks: ReportBlock[] = [
    {
      kind: "kpis",
      items: report.kpis.slice(0, 4).map((k) => ({ label: k.label, value: k.value, hint: k.hint })),
    },
    ...report.chapters.map(
      (c): ReportBlock => ({ kind: "chapter", title: c.title, body: c.body, bullets: c.bullets }),
    ),
  ];

  const planBlock: ReportBlock = {
    kind: "table",
    title: "Fix / Publish / Promote / Measure",
    columns: ["Bucket", "Action", "Effort", "Detail"],
    rows: report.improvisation.map((s) => [s.bucket, s.title, `${s.effortHours}h`, s.detail]),
  };

  const sections: ReportSection[] = [
    { id: "mkt-position", title: "Position summary", blocks: summaryBlocks },
    { id: "mkt-plan", title: "Next best actions", blocks: [planBlock] },
  ];

  return { ...base, sections };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/reports-builder-marketing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/builders/marketing.ts tests/unit/reports-builder-marketing.test.ts
git commit -m "feat(reports): Marketing report builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Shared HTML renderer (single report + combined bundle)

**Files:**
- Create: `lib/reports/render-html.ts`
- Test: `tests/unit/reports-render-html.test.ts`

**Interfaces:**
- Consumes: `ReportModel`, `ReportBlock`, `ReportSection` (Task 1).
- Produces: `renderReportHtml(input: ReportModel | ReportModel[]): string` — full `<!doctype html>` document with shared chrome (cover page, running header/footer via `@page`, print CSS, page-break-before between bundled reports), rendering every block kind including `insufficient`. Array input adds a "Full Position Report" cover and one page per model.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/reports-render-html.test.ts
import { describe, expect, it } from "vitest";
import { renderReportHtml } from "@/lib/reports/render-html";
import type { ReportModel } from "@/lib/reports/types";

const seo: ReportModel = {
  slug: "seo", title: "SEO Report", domain: "acme.com", brand: "Acme", generatedAt: "2026-07-24T00:00:00Z", status: "ready",
  sections: [{ id: "s", title: "Audit", blocks: [
    { kind: "kpis", items: [{ label: "Readiness", value: "72" }] },
    { kind: "table", title: "Issues", columns: ["A"], rows: [["<b>x</b>"]] },
    { kind: "insufficient", reason: "thin data" },
  ] }],
};
const geo: ReportModel = { ...seo, slug: "geo", title: "GEO Report" };

describe("renderReportHtml", () => {
  it("renders a single report as a full HTML document with the brand + title", () => {
    const html = renderReportHtml(seo);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("SEO Report");
    expect(html).toContain("Acme");
    expect(html).toContain("thin data");
  });

  it("escapes interpolated cell content", () => {
    const html = renderReportHtml(seo);
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });

  it("renders a combined bundle with a Full Position Report cover and page breaks", () => {
    const html = renderReportHtml([seo, geo]);
    expect(html).toContain("Full Position Report");
    expect(html).toContain("SEO Report");
    expect(html).toContain("GEO Report");
    expect(html).toContain("page-break-before");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/reports-render-html.test.ts`
Expected: FAIL — cannot resolve `@/lib/reports/render-html`.

- [ ] **Step 3: Write `lib/reports/render-html.ts`**

```typescript
import type { ReportBlock, ReportModel, ReportSection } from "@/lib/reports/types";

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderBlock(block: ReportBlock): string {
  switch (block.kind) {
    case "kpis":
      return `<div class="kpis">${block.items
        .map(
          (i) =>
            `<div class="kpi"><span class="kpi-label">${esc(i.label)}</span><strong>${esc(i.value)}</strong>${
              i.hint ? `<span class="kpi-hint">${esc(i.hint)}</span>` : ""
            }</div>`,
        )
        .join("")}</div>`;
    case "chapter":
      return `<div class="chapter"><h3>${esc(block.title)}</h3><p>${esc(block.body)}</p><ul>${block.bullets
        .map((b) => `<li>${esc(b)}</li>`)
        .join("")}</ul></div>`;
    case "list":
      return `<div class="chapter"><h3>${esc(block.title)}</h3><ul>${block.items
        .map((i) => `<li>${esc(i)}</li>`)
        .join("")}</ul></div>`;
    case "table":
      return `<div class="chapter"><h3>${esc(block.title)}</h3><table><thead><tr>${block.columns
        .map((c) => `<th>${esc(c)}</th>`)
        .join("")}</tr></thead><tbody>${block.rows
        .map((r) => `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></div>`;
    case "callout":
      return `<div class="callout ${block.tone}">${esc(block.text)}</div>`;
    case "insufficient":
      return `<div class="insufficient"><strong>Insufficient evidence.</strong> ${esc(block.reason)}</div>`;
  }
}

function renderSection(section: ReportSection): string {
  return `<section><h2>${esc(section.title)}</h2>${section.blocks.map(renderBlock).join("")}</section>`;
}

function renderModelBody(model: ReportModel, pageBreak: boolean): string {
  return `<article class="report${pageBreak ? " page-break-before" : ""}">
    <header class="report-head">
      <div class="eyebrow">${esc(model.brand)} · ${esc(model.domain)}</div>
      <h1>${esc(model.title)}</h1>
      <div class="meta">Generated ${esc(model.generatedAt)} · status: ${esc(model.status)}</div>
    </header>
    ${model.sections.map(renderSection).join("")}
  </article>`;
}

const STYLES = `
:root { color-scheme: light; --ink:#0f172a; --muted:#475569; --line:#e2e8f0; --accent:#0f766e; --warn:#b45309; }
@page { size: A4; margin: 20mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "Inter", "Helvetica Neue", Arial, sans-serif; margin: 0; color: var(--ink); background: #fff; }
.cover { display:flex; flex-direction:column; justify-content:center; min-height: 90vh; padding: 0 8mm; page-break-after: always; }
.cover .brand { font-size: 13px; letter-spacing: .16em; text-transform: uppercase; color: var(--accent); }
.cover h1 { font-size: 40px; letter-spacing: -0.02em; margin: 12px 0; }
.cover .meta { color: var(--muted); font-size: 14px; }
.report { padding: 0 8mm 8mm; }
.page-break-before { page-break-before: always; }
.report-head { border-bottom: 2px solid var(--accent); padding-bottom: 12px; margin-bottom: 20px; }
.eyebrow { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); }
h1 { font-size: 28px; margin: 6px 0; letter-spacing: -0.01em; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); margin: 28px 0 12px; }
h3 { font-size: 16px; margin: 18px 0 8px; }
p, li, td, th { font-size: 13.5px; line-height: 1.5; color: var(--muted); }
.meta { font-size: 12px; color: var(--muted); }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 8px 0 4px; }
.kpi { border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
.kpi-label { display:block; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.kpi strong { display:block; font-size: 24px; color: var(--ink); margin-top: 4px; }
.kpi-hint { display:block; font-size: 11px; color: #94a3b8; margin-top: 2px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th { text-align: left; border-bottom: 1px solid var(--line); padding: 6px 8px; color: var(--ink); }
td { border-bottom: 1px solid var(--line); padding: 6px 8px; vertical-align: top; }
.callout { border-radius: 8px; padding: 10px 12px; margin: 10px 0; font-size: 13px; }
.callout.info { background: #ecfeff; color: #0e7490; }
.callout.warn { background: #fffbeb; color: var(--warn); }
.insufficient { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 12px; margin: 10px 0; color: var(--muted); font-size: 13px; }
`;

export function renderReportHtml(input: ReportModel | ReportModel[]): string {
  const models = Array.isArray(input) ? input : [input];
  const first = models[0];
  const bundle = models.length > 1;
  const title = bundle ? "Full Position Report" : first.title;

  const cover = `<div class="cover">
    <div class="brand">${esc(first.brand)} · ${esc(first.domain)}</div>
    <h1>${esc(title)}</h1>
    <div class="meta">Generated ${esc(first.generatedAt)}</div>
  </div>`;

  const body = models.map((m, idx) => renderModelBody(m, bundle && idx > 0)).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} — ${esc(first.domain)}</title>
  <style>${STYLES}</style>
</head>
<body>
  ${cover}
  ${body}
</body>
</html>`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/reports-render-html.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/render-html.ts tests/unit/reports-render-html.test.ts
git commit -m "feat(reports): shared premium HTML renderer + bundle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: PDF generator (Playwright, with HTML fallback)

**Files:**
- Create: `lib/reports/generate.ts`
- Test: `tests/unit/reports-generate.test.ts`

**Interfaces:**
- Consumes: `renderReportHtml` (Task 5), `getObjectStore`/`ObjectStore`/`StoredObject` (`@/lib/storage/object-store`), `ReportModel` (Task 1).
- Produces: `generateReportDocument(models: ReportModel | ReportModel[], opts?: { store?: ObjectStore; preferPdf?: boolean }): Promise<{ url: string; format: "pdf" | "html"; stored: StoredObject }>` — follows the `audit-report.ts` pattern exactly; default `preferPdf = process.env.OPENGROWTH_PDF === "playwright"`; on any Chromium error, falls back to storing the HTML artifact.

- [ ] **Step 1: Write the failing test** (fallback path — no browser required)

```typescript
// tests/unit/reports-generate.test.ts
import { describe, expect, it } from "vitest";
import { generateReportDocument } from "@/lib/reports/generate";
import type { ReportModel } from "@/lib/reports/types";

const model: ReportModel = {
  slug: "seo", title: "SEO Report", domain: "acme.com", brand: "Acme", generatedAt: "2026-07-24T00:00:00Z", status: "ready",
  sections: [{ id: "s", title: "Audit", blocks: [{ kind: "insufficient", reason: "n/a" }] }],
};

describe("generateReportDocument", () => {
  it("stores an HTML artifact and returns a served url when PDF is disabled", async () => {
    const out = await generateReportDocument(model, { preferPdf: false });
    expect(out.format).toBe("html");
    expect(out.url).toMatch(/^\/api\/reports\//);
    expect(out.stored.contentType).toContain("text/html");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/reports-generate.test.ts`
Expected: FAIL — cannot resolve `@/lib/reports/generate`.

- [ ] **Step 3: Write `lib/reports/generate.ts`**

```typescript
import { renderReportHtml } from "@/lib/reports/render-html";
import type { ReportModel } from "@/lib/reports/types";
import { getObjectStore, type ObjectStore, type StoredObject } from "@/lib/storage/object-store";

export async function generateReportDocument(
  models: ReportModel | ReportModel[],
  opts: { store?: ObjectStore; preferPdf?: boolean } = {},
): Promise<{ url: string; format: "pdf" | "html"; stored: StoredObject }> {
  const html = renderReportHtml(models);
  const store = opts.store ?? getObjectStore();
  const preferPdf = opts.preferPdf ?? process.env.OPENGROWTH_PDF === "playwright";

  if (preferPdf) {
    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      await browser.close();
      const stored = await store.put({ body: Buffer.from(pdf), contentType: "application/pdf" });
      return { url: stored.url, format: "pdf", stored };
    } catch {
      // Fall through to HTML artifact.
    }
  }

  const stored = await store.put({ body: html, contentType: "text/html; charset=utf-8" });
  return { url: stored.url, format: "html", stored };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/reports-generate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/generate.ts tests/unit/reports-generate.test.ts
git commit -m "feat(reports): PDF/HTML report generator via Playwright

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Report generation API route (status + generate)

**Files:**
- Create: `app/api/reports/generate/route.ts`
- Test: `tests/unit/reports-generate-route.test.ts`

**Interfaces:**
- Consumes: `assembleSpine` (Task 1), `buildSeoReport`/`buildGeoReport`/`buildMarketingReport` (Tasks 2-4), `generateReportDocument` (Task 6).
- Produces:
  - `GET /api/reports/generate?domain=<d>` → `{ statuses: { seo, geo, marketing } }` (each a `SectionStatus`).
  - `POST /api/reports/generate` body `{ domain: string; section: "seo" | "geo" | "marketing" | "full" }` → `{ url, format, section }`; 400 on missing/invalid input.
  - Export `buildModelsForSection(spine, section)` (pure) for unit testing without a live route request.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/reports-generate-route.test.ts
import { describe, expect, it } from "vitest";
import { assembleSpineFrom } from "@/lib/reports/spine";
import { buildModelsForSection } from "@/app/api/reports/generate/route";

describe("buildModelsForSection", () => {
  const spine = assembleSpineFrom("acme.com", null, null);

  it("returns one model for a single section", () => {
    expect(buildModelsForSection(spine, "seo")).toHaveLength(1);
    expect(buildModelsForSection(spine, "seo")[0].slug).toBe("seo");
  });

  it("returns all three, in order, for the full bundle", () => {
    const models = buildModelsForSection(spine, "full");
    expect(models.map((m) => m.slug)).toEqual(["seo", "geo", "marketing"]);
  });

  it("throws on an unknown section", () => {
    // @ts-expect-error deliberate invalid section
    expect(() => buildModelsForSection(spine, "nope")).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/reports-generate-route.test.ts`
Expected: FAIL — cannot resolve `@/app/api/reports/generate/route`.

- [ ] **Step 3: Write `app/api/reports/generate/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { assembleSpine, type AnalysisSpine } from "@/lib/reports/spine";
import { buildSeoReport } from "@/lib/reports/builders/seo";
import { buildGeoReport } from "@/lib/reports/builders/geo";
import { buildMarketingReport } from "@/lib/reports/builders/marketing";
import { generateReportDocument } from "@/lib/reports/generate";
import type { ReportModel } from "@/lib/reports/types";

export const runtime = "nodejs";

export type ReportSectionId = "seo" | "geo" | "marketing" | "full";

const VALID: ReportSectionId[] = ["seo", "geo", "marketing", "full"];

export function buildModelsForSection(spine: AnalysisSpine, section: ReportSectionId): ReportModel[] {
  switch (section) {
    case "seo":
      return [buildSeoReport(spine)];
    case "geo":
      return [buildGeoReport(spine)];
    case "marketing":
      return [buildMarketingReport(spine)];
    case "full":
      return [buildSeoReport(spine), buildGeoReport(spine), buildMarketingReport(spine)];
    default:
      throw new Error(`Unknown report section: ${section}`);
  }
}

export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "A domain is required." }, { status: 400 });
  }
  const spine = await assembleSpine(domain);
  return NextResponse.json({
    statuses: { seo: spine.seo.status, geo: spine.geo.status, marketing: spine.marketing.status },
  });
}

export async function POST(request: Request) {
  let body: { domain?: string; section?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const domain = body.domain?.trim();
  const section = body.section as ReportSectionId | undefined;
  if (!domain) {
    return NextResponse.json({ error: "A domain is required." }, { status: 400 });
  }
  if (!section || !VALID.includes(section)) {
    return NextResponse.json({ error: `section must be one of ${VALID.join(", ")}.` }, { status: 400 });
  }

  const spine = await assembleSpine(domain);
  const models = buildModelsForSection(spine, section);
  const out = await generateReportDocument(models);
  return NextResponse.json({ url: out.url, format: out.format, section });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/reports-generate-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/reports/generate/route.ts tests/unit/reports-generate-route.test.ts
git commit -m "feat(reports): report generation API route (status + generate)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Report Suite UI panel + wire into the marketing report page

**Files:**
- Create: `components/reports/report-suite-panel.tsx`
- Modify: `app/demo/marketing/report/page.tsx` (add the panel below the header)
- Test: `tests/unit/report-suite-panel.test.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/reports/generate` (Task 7); existing UI primitives `@/components/ui/button`, `@/components/ui/badge`, `@/components/ui/card`.
- Produces: `export function ReportSuitePanel({ domain }: { domain: string })` — a client component rendering four generate actions (SEO / GEO / Marketing / Full Position Report), each with a status badge fetched on mount; clicking a button POSTs and opens the returned `url` in a new tab.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/report-suite-panel.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ReportSuitePanel } from "@/components/reports/report-suite-panel";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ statuses: { seo: "ready", geo: "insufficient", marketing: "not_run" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

describe("ReportSuitePanel", () => {
  it("renders the four export actions and fetched statuses", async () => {
    render(<ReportSuitePanel domain="acme.com" />);
    expect(screen.getByRole("button", { name: /SEO Report/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /GEO Report/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Marketing Report/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Full Position Report/i })).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/insufficient/i)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/report-suite-panel.test.tsx`
Expected: FAIL — cannot resolve `@/components/reports/report-suite-panel`.

- [ ] **Step 3: Write `components/reports/report-suite-panel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SectionId = "seo" | "geo" | "marketing" | "full";
type Status = "ready" | "not_run" | "insufficient";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "seo", label: "SEO Report" },
  { id: "geo", label: "GEO Report" },
  { id: "marketing", label: "Marketing Report" },
  { id: "full", label: "Full Position Report" },
];

export function ReportSuitePanel({ domain }: { domain: string }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState<SectionId | null>(null);

  useEffect(() => {
    if (!domain) return;
    void fetch(`/api/reports/generate?domain=${encodeURIComponent(domain)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.statuses) setStatuses(d.statuses);
      });
  }, [domain]);

  async function generate(section: SectionId) {
    setBusy(section);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, section }),
      });
      const data = await res.json();
      if (data?.url) window.open(data.url, "_blank", "noopener");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report suite</CardTitle>
        <CardDescription>Export any section on its own, or the full combined report.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((s) => {
          const status = s.id === "full" ? undefined : statuses[s.id];
          return (
            <div key={s.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.label}</span>
                {status ? <Badge variant="outline">{status}</Badge> : null}
              </div>
              <Button size="sm" disabled={busy !== null} onClick={() => generate(s.id)}>
                {busy === s.id ? "Generating…" : `Download ${s.label}`}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/report-suite-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the panel into `app/demo/marketing/report/page.tsx`**

Add the import near the other component imports:

```tsx
import { ReportSuitePanel } from "@/components/reports/report-suite-panel";
```

Then render it immediately after the `<PageHeader … />` block (inside the returned fragment, before the `{!ws && (…)}` block):

```tsx
{result?.project.domain ? <ReportSuitePanel domain={result.project.domain} /> : null}
```

- [ ] **Step 6: Run the full unit suite to confirm no regressions**

Run: `npm test`
Expected: PASS (all existing tests plus the new report suite tests).

- [ ] **Step 7: Commit**

```bash
git add components/reports/report-suite-panel.tsx app/demo/marketing/report/page.tsx tests/unit/report-suite-panel.test.tsx
git commit -m "feat(reports): report suite panel with per-section PDF export

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Manual verification (after Task 8)

1. `OPENGROWTH_PDF=playwright npm run dev`, run an analysis for a domain so a project + marketing workspace exist.
2. Open `/demo/marketing/report`. Confirm the Report Suite panel shows SEO/GEO/Marketing status badges.
3. Click each of the four buttons; confirm a PDF opens via `/api/reports/<id>` with a cover page, and the Full Position Report contains all three sections with page breaks.
4. Delete the marketing workspace file and reload; confirm Marketing shows `not_run` and its PDF renders the "Insufficient evidence" block rather than a fabricated score.

## Self-Review Notes (spec coverage)

- Three views on one spine → Tasks 1–4. ✓
- Three separate PDFs + combined bundle → Tasks 5–7 (`buildModelsForSection`, `renderReportHtml` array path). ✓
- Best-in-class PDF via Playwright + existing object store/route → Task 6 (mirrors `audit-report.ts`). ✓
- Full-always run, per-section `status` retained for future partial → `SectionStatus` on every section (Task 1), surfaced in UI (Task 8). ✓
- Evidence gating / no fake scores → `insufficient` block in every builder + renderer + manual step 4. ✓
- UX: three cards + Full button with status badges → Task 8. ✓
- Testing: unit per builder incl. insufficient path, golden-ish HTML assertions, generator fallback, route model selection, panel render → Tasks 1–8. ✓
