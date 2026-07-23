# Provenance UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface each metric's value, confidence, 95% interval, sample, and basis on the dashboard through Metric-native components styled to the shadcnblocks-admin KPI aesthetic, gating any sampled number below its minimum sample.

**Architecture:** Three presentational components in `components/metrics/` take a `Metric` (never loose numbers). Provenance renders as an always-visible caption under the value, not a hover tooltip — more honest and testable. The marketing dashboard computes the GEO metric client-side from real workspace numbers via the pure `geoMentionMetric`.

**Tech Stack:** React 19, Next 15, shadcn (new-york/neutral), Tailwind, Vitest + @testing-library/react (jsdom).

## Global Constraints

- Components take a `Metric`, never a bare number — a component cannot render a double-multiplied percent or an ungated sampled rate.
- A sampled metric below `minReliable` renders `gateMessage`, never a bare value.
- No dummy data: components render only what the passed `Metric` contains; the dashboard computes the metric from real `report.scoreboard` numbers.
- `npm test`, `npm run typecheck`, `npm run lint` (`--max-warnings=0`), `npm run build` all pass. Alias `@/` → repo root.

---

### Task 1: ConfidenceBadge + enable .tsx tests

**Files:**
- Create: `components/metrics/confidence-badge.tsx`
- Modify: `vitest.config.ts` (add `tests/unit/**/*.test.tsx` to `include`)
- Test: `tests/unit/confidence-badge.test.tsx`

**Interfaces:**
- Consumes: `MetricConfidence` from `@/lib/metrics/types`; `Badge` from `@/components/ui/badge`; `cn` from `@/lib/utils`
- Produces: `ConfidenceBadge({ confidence?: MetricConfidence })`

- [ ] **Step 1: Add the .tsx glob to vitest**

In `vitest.config.ts`, add to the `include` array:

```ts
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/eval/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/confidence-badge.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceBadge } from "@/components/metrics/confidence-badge";

describe("ConfidenceBadge", () => {
  it("labels each confidence level", () => {
    const { rerender } = render(<ConfidenceBadge confidence="high" />);
    expect(screen.getByText(/high confidence/i)).toBeDefined();
    rerender(<ConfidenceBadge confidence="medium" />);
    expect(screen.getByText(/medium confidence/i)).toBeDefined();
    rerender(<ConfidenceBadge confidence="low" />);
    expect(screen.getByText(/low confidence/i)).toBeDefined();
    rerender(<ConfidenceBadge confidence="insufficient" />);
    expect(screen.getByText(/insufficient sample/i)).toBeDefined();
  });

  it("renders nothing for an unsampled metric", () => {
    const { container } = render(<ConfidenceBadge confidence={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/confidence-badge.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/metrics/confidence-badge"`

- [ ] **Step 4: Write the component**

Create `components/metrics/confidence-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MetricConfidence } from "@/lib/metrics/types";

const STYLES: Record<MetricConfidence, { label: string; dot: string; className: string }> = {
  high: {
    label: "High confidence",
    dot: "bg-emerald-500",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  medium: {
    label: "Medium confidence",
    dot: "bg-foreground/50",
    className: "",
  },
  low: {
    label: "Low confidence",
    dot: "bg-amber-500",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  insufficient: {
    label: "Insufficient sample",
    dot: "bg-muted-foreground",
    className: "text-muted-foreground",
  },
};

export function ConfidenceBadge({ confidence }: { confidence?: MetricConfidence }) {
  if (!confidence) return null;
  const s = STYLES[confidence];
  const variant = confidence === "medium" ? "secondary" : "outline";
  return (
    <Badge variant={variant} className={cn("gap-1.5 font-normal", s.className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </Badge>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/confidence-badge.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add components/metrics/confidence-badge.tsx vitest.config.ts tests/unit/confidence-badge.test.tsx
git commit -m "feat(ui): ConfidenceBadge and .tsx component test support"
```

---

### Task 2: MetricStat and MetricValue

**Files:**
- Create: `components/metrics/metric-value.tsx`
- Create: `components/metrics/metric-stat.tsx`
- Test: `tests/unit/metric-stat.test.tsx`

**Interfaces:**
- Consumes: `Metric` from `@/lib/metrics/types`; `formatMetric`, `isReliable`, `gateMessage` from `@/lib/metrics/format`; `ConfidenceBadge` (Task 1); `Card`, `CardHeader`, `CardDescription` from `@/components/ui/card`; `cn`
- Produces: `MetricValue({ metric })`, `MetricStat({ label, metric, previous?, className? })`, and a local `provenanceCaption(metric): string`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/metric-stat.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricStat } from "@/components/metrics/metric-stat";
import { MetricValue } from "@/components/metrics/metric-value";
import { geoMentionMetric } from "@/lib/marketing/metrics-view";

describe("MetricStat", () => {
  it("shows the value, confidence, and interval caption when reliable", () => {
    const metric = geoMentionMetric({ brandMentionRate: 40, sampleSize: 25 });
    render(<MetricStat label="Answer-engine mention" metric={metric} />);
    expect(screen.getByText("40%")).toBeDefined();
    expect(screen.getByText(/confidence/i)).toBeDefined();
    expect(screen.getByText(/95% CI/i)).toBeDefined();
    expect(screen.getByText(/n=25/i)).toBeDefined();
  });

  it("gates below the minimum sample and shows no bare percentage", () => {
    const metric = geoMentionMetric({ brandMentionRate: 33, sampleSize: 3 });
    render(<MetricStat label="Answer-engine mention" metric={metric} />);
    expect(screen.getByText(/insufficient sample — n=3, need 20/i)).toBeDefined();
    expect(screen.queryByText("33%")).toBeNull();
  });

  it("renders the previous line when supplied", () => {
    const metric = geoMentionMetric({ brandMentionRate: 40, sampleSize: 25 });
    render(<MetricStat label="X" metric={metric} previous="32% previous" />);
    expect(screen.getByText("32% previous")).toBeDefined();
  });
});

describe("MetricValue", () => {
  it("renders the value when reliable and the gate text when not", () => {
    const { rerender } = render(<MetricValue metric={geoMentionMetric({ brandMentionRate: 40, sampleSize: 25 })} />);
    expect(screen.getByText("40%")).toBeDefined();
    rerender(<MetricValue metric={geoMentionMetric({ brandMentionRate: 40, sampleSize: 2 })} />);
    expect(screen.getByText(/insufficient sample/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/metric-stat.test.tsx`
Expected: FAIL — components not found.

- [ ] **Step 3: Write MetricValue**

Create `components/metrics/metric-value.tsx`:

```tsx
import { formatMetric, gateMessage, isReliable } from "@/lib/metrics/format";
import { cn } from "@/lib/utils";
import type { Metric } from "@/lib/metrics/types";

/** The short human-readable provenance line for a metric. */
export function provenanceCaption(metric: Metric): string {
  const parts: string[] = [];
  if (metric.interval) {
    parts.push(`95% CI ${Math.round(metric.interval.low)}–${Math.round(metric.interval.high)}%`);
  }
  if (metric.sample) parts.push(`n=${metric.sample.n}`);
  parts.push(metric.basis);
  return parts.join(" · ");
}

export function MetricValue({ metric, className }: { metric: Metric; className?: string }) {
  const reliable = isReliable(metric);
  return (
    <span
      className={cn(reliable ? "tabular-nums" : "text-muted-foreground", className)}
      title={provenanceCaption(metric)}
    >
      {reliable ? formatMetric(metric) : gateMessage(metric)}
    </span>
  );
}
```

- [ ] **Step 4: Write MetricStat**

Create `components/metrics/metric-stat.tsx`:

```tsx
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { ConfidenceBadge } from "@/components/metrics/confidence-badge";
import { provenanceCaption } from "@/components/metrics/metric-value";
import { formatMetric, gateMessage, isReliable } from "@/lib/metrics/format";
import { cn } from "@/lib/utils";
import type { Metric } from "@/lib/metrics/types";

export function MetricStat({
  label,
  metric,
  previous,
  className,
}: {
  label: string;
  metric: Metric;
  previous?: string;
  className?: string;
}) {
  const reliable = isReliable(metric);
  return (
    <Card className={cn("gap-3 py-5", className)}>
      <CardHeader className="gap-2">
        <CardDescription>{label}</CardDescription>
        {previous ? <p className="text-xs text-muted-foreground">{previous}</p> : null}
        {reliable ? (
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatMetric(metric)}</p>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">{gateMessage(metric)}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceBadge confidence={metric.confidence} />
        </div>
        <p className="text-xs text-muted-foreground" title={metric.basis}>
          {provenanceCaption(metric)}
        </p>
      </CardHeader>
    </Card>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/metric-stat.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add components/metrics/metric-value.tsx components/metrics/metric-stat.tsx tests/unit/metric-stat.test.tsx
git commit -m "feat(ui): MetricStat and MetricValue with visible provenance and gating"
```

---

### Task 3: Wire the provenance stat into the marketing dashboard

**Files:**
- Modify: `components/marketing/marketing-os-dashboard.tsx`
- Test: none new (data path already covered by `tests/unit/geo-mention-metric.test.ts`)

**Interfaces:**
- Consumes: `MetricStat` (Task 2), `geoMentionMetric` from `@/lib/marketing/metrics-view`

- [ ] **Step 1: Add the imports**

In `components/marketing/marketing-os-dashboard.tsx`, add near the other imports:

```tsx
import { MetricStat } from "@/components/metrics/metric-stat";
import { geoMentionMetric } from "@/lib/marketing/metrics-view";
```

- [ ] **Step 2: Render the provenance stat above the KPI row**

Find the KPI grid (the `ws.report.kpis.map(...)` block around line 202–206). Immediately before that `<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">`, insert:

```tsx
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricStat
              label="Answer-engine mention"
              metric={geoMentionMetric({
                brandMentionRate: ws.report.scoreboard.geoMentionRate,
                sampleSize: ws.report.scoreboard.geoSampleSize,
              })}
            />
          </div>
```

This renders only when a workspace exists (the block is already inside the `ws` guard). Below n=20 it shows the gate; above, the value plus its interval caption.

- [ ] **Step 3: Verify in isolation**

Run: `npm run typecheck`
Expected: PASS. If `report.scoreboard.geoSampleSize` is optionally undefined in the type, coerce with `?? 0` in the call.

- [ ] **Step 4: Full verification**

Run:
```bash
rm -rf .data && npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all PASS, zero warnings, `.data/` absent after tests, `/demo/marketing` in the build output.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/marketing-os-dashboard.tsx
git commit -m "feat(marketing): show gated answer-engine mention with provenance on the dashboard"
```

---

## What this plan does not cover

- Applying `MetricValue`/`MetricStat` to every other numeric surface (audit
  tiles, report tables) — a mechanical follow-up now that the components exist.
- Tactic-priority provenance in `deep-engine.ts`.
- A dedicated full-page admin redesign; this slice adds the provenance component
  system and wires the highest-value sampled metric, matching the reference
  aesthetic without a wholesale rebuild.
