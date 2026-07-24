/**
 * GIL-14 — Outcome reweighting (bandit).
 *
 * Feed the per-fix-type outcome stats (GIL-13) into a Thompson/Beta bandit: each
 * fix type is an arm whose Beta posterior is updated by its wins and losses
 * (a win = a significant positive citation lift). The posterior mean is the
 * learned weight GIL-15 reads back into the recommender.
 *
 * Untried fix types keep the uniform prior (weight 0.5), so the recommender still
 * explores them instead of freezing on early winners.
 */

import { createExperiment, posteriorMeans, type BanditExperiment } from "@/lib/bandit/thompson";
import { FIX_TYPES, type FixTypeId } from "@/lib/engines/geo-fix-taxonomy";
import type { FixTypeOutcomeStat } from "@/lib/engines/geo-fix-outcomes";

const FIX_DEFS = Object.values(FIX_TYPES);

export function buildFixTypeExperiment(stats: FixTypeOutcomeStat[]): BanditExperiment {
  const experiment = createExperiment({
    id: "geo-fix-types",
    name: "GEO fix-type reweighting",
    arms: FIX_DEFS.map((def) => ({ id: def.id, label: def.label, payload: { fixTypeId: def.id } })),
  });

  const byType = new Map(stats.map((s) => [s.fixTypeId, s]));
  for (const arm of experiment.arms) {
    const stat = byType.get(arm.id as FixTypeId);
    if (!stat) continue;
    const losses = stat.trials - stat.wins;
    arm.alpha += stat.wins;
    arm.beta += Math.max(0, losses);
  }
  return experiment;
}

/** Learned weight (posterior mean, 0..1) per fix type; untried types weight 0.5. */
export function fixTypeWeights(stats: FixTypeOutcomeStat[]): Record<FixTypeId, number> {
  return posteriorMeans(buildFixTypeExperiment(stats)) as Record<FixTypeId, number>;
}
