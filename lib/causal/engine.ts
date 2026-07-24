// lib/causal/engine.ts
import type {
  AccountConstraints,
  ExperimentDesign,
  Feasibility,
  Intervention,
  LiftResult,
} from "./types";
import type { OutcomeStreamProvider } from "./outcomes";
import { diffInDiff, syntheticControl } from "./estimator";
import { feasibility } from "./power";
import { selectDesign } from "./ladder";

export interface CausalReport {
  intervention: Intervention;
  design: ExperimentDesign;
  feasibility: Feasibility;
  lift: LiftResult | null;
  honest: string;
}

const DAY_MS = 86_400_000;

function isoShift(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}

export async function runCausalTest(args: {
  intervention: Intervention;
  constraints: AccountConstraints;
  outcomes: OutcomeStreamProvider;
  controlScope?: string;
  windowDays?: number;
}): Promise<CausalReport> {
  const windowDays = args.windowDays ?? 21;
  const design = selectDesign(args.constraints, windowDays);
  const feas = feasibility(args.constraints, windowDays);

  if (design.rung === "observational") {
    return {
      intervention: args.intervention,
      design,
      feasibility: feas,
      lift: null,
      honest: "Insufficient — we won't declare a winner without enough signal.",
    };
  }

  const from = isoShift(args.intervention.startedAt, -windowDays);
  const to = args.intervention.endedAt ?? isoShift(args.intervention.startedAt, windowDays);
  const treat = await args.outcomes.fetch(
    { geoScope: args.intervention.geoScope, unit: "conversions" },
    { from, to },
  );
  const control = await args.outcomes.fetch({ geoScope: args.controlScope, unit: "conversions" }, { from, to });

  const lift =
    design.rung === "geo_holdout" || design.rung === "time_pulse" || design.rung === "switchback"
      ? diffInDiff(treat, control, args.intervention.startedAt, design.label)
      : syntheticControl(treat, control, args.intervention.startedAt);

  const honest = `${labelText(lift.label)}: ${lift.liftPct}% lift (95% CI ${lift.interval.low}% to ${lift.interval.high}%).`;
  return { intervention: args.intervention, design, feasibility: feas, lift, honest };
}

function labelText(label: LiftResult["label"]): string {
  switch (label) {
    case "high_causal":
      return "High confidence (causal)";
    case "good_causal_temporal":
      return "Good confidence (causal, temporal)";
    case "directional_modeled":
      return "Directional (modeled)";
    default:
      return "Insufficient";
  }
}
