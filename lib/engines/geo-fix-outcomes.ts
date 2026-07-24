/**
 * GIL-13 — Fix-outcome store.
 *
 * Turn measured lifts (GIL-11) into per-fix-type outcome statistics — the record
 * of "when we shipped fix type X, how often did citations actually rise, and by
 * how much". GIL-14 feeds these to the bandit; GIL-15 reads the resulting weights
 * back into the recommender. Pure aggregation over provided outcomes; a durable
 * store persists the list.
 */

import type { CitationLift } from "@/lib/engines/geo-lift";
import type { LiftLabel } from "@/lib/engines/geo-lift";
import { fixForFlag, type FixTypeId } from "@/lib/engines/geo-fix-taxonomy";

export interface FixOutcome {
  fixTypeId: FixTypeId;
  label: LiftLabel;
  deltaShare: number;
  significant: boolean;
  /** A win = a statistically significant positive change in citation share. */
  win: boolean;
}

export interface FixTypeOutcomeStat {
  fixTypeId: FixTypeId;
  trials: number;
  wins: number;
  causalWins: number;
  winRate: number; // wins / trials, 0..1 2dp
  avgDeltaShare: number; // mean deltaShare across trials, 2dp
}

export function recordFixOutcome(lift: CitationLift): FixOutcome {
  const fixTypeId = fixForFlag(lift.feature).id;
  const win = lift.significant && lift.deltaShare > 0;
  return { fixTypeId, label: lift.label, deltaShare: lift.deltaShare, significant: lift.significant, win };
}

export function aggregateFixOutcomes(outcomes: FixOutcome[]): FixTypeOutcomeStat[] {
  const byType = new Map<FixTypeId, FixOutcome[]>();
  for (const o of outcomes) {
    const list = byType.get(o.fixTypeId) ?? [];
    list.push(o);
    byType.set(o.fixTypeId, list);
  }

  return [...byType.entries()]
    .map(([fixTypeId, list]) => {
      const trials = list.length;
      const wins = list.filter((o) => o.win).length;
      const causalWins = list.filter((o) => o.label === "causal").length;
      const sumDelta = list.reduce((acc, o) => acc + o.deltaShare, 0);
      return {
        fixTypeId,
        trials,
        wins,
        causalWins,
        winRate: trials ? Math.round((wins / trials) * 100) / 100 : 0,
        avgDeltaShare: trials ? Math.round((sumDelta / trials) * 100) / 100 : 0,
      };
    })
    .sort((a, b) => a.fixTypeId.localeCompare(b.fixTypeId));
}
