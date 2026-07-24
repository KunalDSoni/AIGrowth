// lib/causal/ladder.ts
import type { AccountConstraints, ExperimentDesign } from "./types";
import { feasibility } from "./power";

export function selectDesign(constraints: AccountConstraints, windowDays = 21): ExperimentDesign {
  const feas = feasibility(constraints, windowDays);

  if (constraints.markets >= 2 && feas.adequatelyPowered) {
    return {
      rung: "geo_holdout",
      label: "high_causal",
      minWindowDays: windowDays,
      rationale: "Multiple markets + adequate power → matched treat/control holdout.",
    };
  }
  if (constraints.canPulseBudget && feas.adequatelyPowered) {
    return {
      rung: "time_pulse",
      label: "good_causal_temporal",
      minWindowDays: windowDays,
      rationale: "Single market, but spend can pulse on/off for a temporal test.",
    };
  }
  if (Number.isFinite(feas.minDetectableEffectPct)) {
    return {
      rung: "synthetic_control",
      label: "directional_modeled",
      minWindowDays: windowDays,
      rationale: "No clean experiment feasible; modeled counterfactual only.",
    };
  }
  return {
    rung: "observational",
    label: "insufficient",
    minWindowDays: windowDays,
    rationale: "Insufficient volume for any credible estimate.",
  };
}
