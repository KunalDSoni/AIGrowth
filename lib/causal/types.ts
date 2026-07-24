// lib/causal/types.ts

export type ChannelId = string;

export interface Intervention {
  id: string;
  channel: ChannelId;
  hypothesis: string;
  startedAt: string; // ISO timestamp
  endedAt?: string; // ISO timestamp
  geoScope?: string; // market id, when geo-scoped
  spendDeltaUsd?: number;
  metadata?: Record<string, string | number | boolean>;
}

export type OutcomeUnit = "conversions" | "revenue" | "clicks" | "signups";

export interface OutcomePoint {
  period: string; // ISO date of the bucket (e.g. a day)
  value: number;
  n?: number;
}

export interface OutcomeSeries {
  unit: OutcomeUnit;
  points: OutcomePoint[];
}

export interface AccountConstraints {
  markets: number; // distinct geographic markets available
  dailyOutcomeVolume: number; // typical outcomes/day (for power)
  canPulseBudget: boolean; // can spend be toggled on/off?
}

export type Rung =
  | "geo_holdout"
  | "time_pulse"
  | "switchback"
  | "synthetic_control"
  | "observational";

export type ConfidenceLabel =
  | "high_causal"
  | "good_causal_temporal"
  | "directional_modeled"
  | "insufficient";

export interface ExperimentDesign {
  rung: Rung;
  label: ConfidenceLabel;
  minWindowDays: number;
  rationale: string;
}

export interface Feasibility {
  minDetectableEffectPct: number; // relative MDE at the window
  windowDays: number;
  adequatelyPowered: boolean;
  note: string;
}

export interface LiftResult {
  liftPct: number; // point estimate, percent
  interval: { low: number; high: number }; // 95%, percent
  label: ConfidenceLabel;
  method: "diff_in_diff" | "synthetic_control";
  basis: "measured" | "estimated";
  note: string;
}
