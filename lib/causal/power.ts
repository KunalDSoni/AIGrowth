// lib/causal/power.ts
import type { AccountConstraints, Feasibility } from "./types";

const Z_ALPHA = 1.96; // two-sided 95%
const Z_POWER = 0.84; // 80% power
const POWERED_MDE_PCT = 20;

/** Minimum detectable relative effect (percent) for a 2-arm rate test over a window. */
export function feasibility(constraints: AccountConstraints, windowDays: number): Feasibility {
  const expectedCount = constraints.dailyOutcomeVolume * windowDays;
  if (expectedCount <= 0) {
    return {
      minDetectableEffectPct: Number.POSITIVE_INFINITY,
      windowDays,
      adequatelyPowered: false,
      note: "Insufficient volume to detect any effect.",
    };
  }
  const mdePct = (Z_ALPHA + Z_POWER) * Math.sqrt(2 / expectedCount) * 100;
  const rounded = Math.round(mdePct * 10) / 10;
  return {
    minDetectableEffectPct: rounded,
    windowDays,
    adequatelyPowered: rounded <= POWERED_MDE_PCT,
    note: `With ~${constraints.dailyOutcomeVolume}/day over ${windowDays} days, smallest detectable lift ≈ ±${rounded}%.`,
  };
}
