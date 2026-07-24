// lib/windtunnel/aggregate.ts
import type { ObjectionMap, PersonaReaction, SegmentDelta, Stimulus, VariantScore } from "./types";

export function rankVariants(reactions: PersonaReaction[], stimulus: Stimulus): VariantScore[] {
  const wins = new Map<string, number>();
  let samples = 0;
  for (const r of reactions) {
    for (const c of r.choices) {
      wins.set(c.winnerVariantId, (wins.get(c.winnerVariantId) ?? 0) + 1);
      samples += 1;
    }
  }
  const scores: VariantScore[] = stimulus.variants.map((v) => {
    const w = wins.get(v.id) ?? 0;
    return { variantId: v.id, wins: w, samples, winShare: samples > 0 ? w / samples : 0 };
  });
  return scores.sort((a, b) => b.winShare - a.winShare);
}

export function buildObjectionMap(reactions: PersonaReaction[]): ObjectionMap {
  const byPersona: Record<string, string[]> = {};
  const counts = new Map<string, number>();
  for (const r of reactions) {
    const set = new Set<string>();
    for (const c of r.choices) {
      for (const o of c.objectionsRaised) {
        set.add(o);
        counts.set(o, (counts.get(o) ?? 0) + 1);
      }
    }
    byPersona[r.personaId] = [...set];
  }
  const overall = [...counts.entries()]
    .map(([objection, count]) => ({ objection, count }))
    .sort((a, b) => b.count - a.count);
  return { byPersona, overall };
}

export function segmentDeltas(reactions: PersonaReaction[], stimulus: Stimulus): SegmentDelta[] {
  return stimulus.variants.map((v) => {
    const bySegment: Record<string, number> = {};
    const segTotals = new Map<string, { wins: number; samples: number }>();
    for (const r of reactions) {
      const agg = segTotals.get(r.segment) ?? { wins: 0, samples: 0 };
      for (const c of r.choices) {
        agg.samples += 1;
        if (c.winnerVariantId === v.id) agg.wins += 1;
      }
      segTotals.set(r.segment, agg);
    }
    for (const [seg, agg] of segTotals) {
      bySegment[seg] = agg.samples > 0 ? agg.wins / agg.samples : 0;
    }
    return { variantId: v.id, bySegment };
  });
}
