// tests/support/causal-synthetic.ts
import type { OutcomeSeries } from "@/lib/causal/types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SyntheticSpec {
  baseline: number; // pre-period daily mean for both arms
  noise: number; // fractional jitter amplitude (0 = deterministic)
  preDays: number;
  postDays: number;
  trueLiftPct: number; // applied to treat post only
  controlDrift?: number; // multiplicative post-period trend on both arms
  seed?: number;
}

const DAY_MS = 86_400_000;
const EPOCH = Date.parse("2026-01-01T00:00:00.000Z");

export function generatePair(spec: SyntheticSpec): {
  treat: OutcomeSeries;
  control: OutcomeSeries;
  startedAt: string;
} {
  const rnd = mulberry32(spec.seed ?? 1);
  const drift = spec.controlDrift ?? 1;
  const jitter = () => 1 + (rnd() - 0.5) * 2 * spec.noise;
  const treat: OutcomeSeries = { unit: "conversions", points: [] };
  const control: OutcomeSeries = { unit: "conversions", points: [] };

  let idx = 0;
  for (let d = 0; d < spec.preDays; d++, idx++) {
    const period = new Date(EPOCH + idx * DAY_MS).toISOString();
    treat.points.push({ period, value: spec.baseline * jitter() });
    control.points.push({ period, value: spec.baseline * jitter() });
  }
  const startedAt = new Date(EPOCH + idx * DAY_MS).toISOString();
  for (let d = 0; d < spec.postDays; d++, idx++) {
    const period = new Date(EPOCH + idx * DAY_MS).toISOString();
    treat.points.push({ period, value: spec.baseline * drift * (1 + spec.trueLiftPct / 100) * jitter() });
    control.points.push({ period, value: spec.baseline * drift * jitter() });
  }
  return { treat, control, startedAt };
}
