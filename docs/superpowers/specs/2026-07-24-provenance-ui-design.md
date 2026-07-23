# Provenance UI — Design

**Date:** 2026-07-24
**Status:** Approved (user: "YES FOR UI", reference https://shadcnblocks-admin.vercel.app/)
**Product:** OpenGrowth AI Engine
**Slice:** Sub-project 3 of the metric-integrity effort — make the statistical rigor visible.

## Why

Sub-projects 1–2 built a typed `Metric` carrying value, unit, basis, sample, a
95% Wilson interval, and computed confidence — but on the interactive dashboards
none of that reaches the user. The `KpiStatCard` takes a plain `value: string`;
intervals, confidence, and sample gating are invisible except in the printed
Position Report headline. This slice surfaces them.

The display rule set during sub-project 1 is now made visual:

- **Primary surfaces** (KPI tiles): a metric below its minimum sample shows the
  gate message ("Insufficient sample — n=3, need 20") in place of a number.
- **Inspection** (tooltip): value, 95% interval, n, and basis are always
  available on hover.
- **Invariant:** a number is never shown as reliable below its minimum sample.

## Visual reference

shadcnblocks-admin: clean KPI stat cards — large `tabular-nums` value, a compact
label above, a trend/status badge, and a supporting "previous period" line
below; muted neutral palette; generous spacing. Our stack is already shadcn
"new-york" / neutral with `card`, `badge`, `tooltip` primitives present, so the
components below match that system rather than introduce a new one.

## Components

All three are Metric-native — they take a `Metric`, never loose numbers — so a
component can never render a percent that was multiplied twice or a rate that is
below its sample.

### ConfidenceBadge

```tsx
ConfidenceBadge({ confidence?: MetricConfidence }): JSX.Element | null
```

Renders nothing when `confidence` is undefined (an exact count, not a sample).
Otherwise a small badge with a status dot and label:

- `high` → emerald tint, "High confidence"
- `medium` → neutral/secondary, "Medium confidence"
- `low` → amber tint, "Low confidence"
- `insufficient` → muted outline, "Insufficient sample"

Colours are Tailwind utility tints layered on the shadcn `Badge`, theme-aware
via existing CSS variables.

### MetricStat

```tsx
MetricStat({
  label: string;
  metric: Metric;
  previous?: string;   // e.g. "32% previous"
  className?: string;
}): JSX.Element
```

The provenance-aware KPI card, matching the reference anatomy:

- **Label** (`CardDescription`, small muted) at top.
- **Value**: when `isReliable(metric)` → `formatMetric(metric)` in
  `text-3xl font-semibold tabular-nums`; otherwise `gateMessage(metric)` in
  muted `text-sm`, no large number.
- **ConfidenceBadge** inline beside/under the value.
- **Previous** line (`text-xs muted`) when supplied.
- **Tooltip** wrapping the card content: when an interval exists,
  `95% CI {low}–{high}% · n={n} · {basis}`; otherwise `{basis} · n={n}` or just
  `{basis}` for unsampled metrics. Uses the existing `Tooltip` primitive.

### MetricValue (inline)

```tsx
MetricValue({ metric: Metric }): JSX.Element
```

For inline/table use: `formatMetric` (or gate message) plus a small confidence
dot, with the same tooltip. Reused inside `MetricStat`'s value area and
available for tables.

## Wiring

The marketing OS dashboard's scoreboard gains one real provenance stat. The
workspace already carries `report.scoreboard.geoMentionRate` and
`geoSampleSize` (plain numbers) to the client; `geoMentionMetric` is a pure
function, so the client computes the full metric with no server change:

```tsx
const mention = geoMentionMetric({
  brandMentionRate: ws.report.scoreboard.geoMentionRate,
  sampleSize: ws.report.scoreboard.geoSampleSize,
});
// ...
<MetricStat label="Answer-engine mention" metric={mention} />
```

Below n=20 (the design-partner's current reality) this visibly gates; above it,
the value shows with its Wilson interval on hover. No dummy data: the stat
renders only from real workspace numbers, and the existing empty states cover
the no-workspace case.

The existing `KpiStatCard` and its plain-string KPI row are left in place for the
non-statistical KPIs (which are exact strings, not sampled rates); `MetricStat`
is added for the sampled GEO metric where provenance matters. `KpiStatCard` is
not deleted — it still serves the deterministic KPIs honestly.

## Testing

Component tests via `@testing-library/react` (installed) in `tests/unit/*.test.tsx`.
Vitest's `include` gains `tests/unit/**/*.test.tsx`.

- `ConfidenceBadge`: renders the right label per confidence; renders nothing for
  `undefined`.
- `MetricStat` reliable: shows the formatted value and no gate message; the
  confidence badge appears; the tooltip content contains "95% CI" and "n=".
- `MetricStat` gated: a metric with `sample.n < minReliable` shows
  "Insufficient sample — n=3, need 20" and **not** a bare percentage; the
  "Insufficient sample" badge appears.
- `MetricValue`: reliable renders the value; gated renders the gate text.
- Integration (pure, no DOM): `geoMentionMetric` fed the scoreboard numbers
  yields a gated metric at n=3 and a reliable one at n=25 — already covered by
  the sub-project-2 test, referenced here so the wiring's data path is proven.

## Error handling

- A `Metric` with a non-finite value renders "—" (via `formatMetric`) and is
  treated as unreliable; never a bare number.
- `MetricStat` with no `previous` simply omits that line.
- Tooltip degrades: no interval → shows basis and n; no sample → shows basis
  only.

## Honesty constraints

Every displayed rate carries its basis and, when sampled, its interval and n.
No sampled number renders as reliable below its minimum sample. The UI shows
only what the metric actually contains — it computes nothing and invents nothing.
