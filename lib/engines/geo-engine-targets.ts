/**
 * GIL-XE-1 — Engine fix targeting.
 *
 * From the cross-engine ledger (ME-3), rank the engines to focus on: engines
 * where the brand is *absent* (answered but never cited), weighted by how
 * measured the engine is and how much competitor pressure exists there. A
 * simulated (Mock) engine never outranks a real measured gap, and is always
 * flagged directional.
 */

import type { CrossEngineLedger, EngineCitationSummary } from "@/lib/engines/geo-cross-engine-ledger";

/** Measurement base priority — a measured gap always outweighs a simulated one. */
const MEASUREMENT_BASE: Record<EngineCitationSummary["measurement"], number> = {
  measured: 10,
  estimate: 6,
  simulated: 2,
};

export interface EngineFixTarget {
  engine: string;
  measurement: EngineCitationSummary["measurement"];
  sampleSize: number;
  reliable: boolean;
  citedShare: number;
  competitorsCitedThere: { domain: string; count: number }[];
  priority: number;
  rationale: string;
}

export interface EngineTargetPlan {
  targets: EngineFixTarget[];
  focusEngine?: string;
  note: string;
}

export function buildEngineTargetPlan(cross: CrossEngineLedger): EngineTargetPlan {
  const targets: EngineFixTarget[] = cross.engines
    .filter((e) => e.state === "absent")
    .map((e) => {
      const pressure = e.topCompetitors.reduce((n, c) => n + c.count, 0);
      const raw = (MEASUREMENT_BASE[e.measurement] + Math.min(pressure, 10) * 0.5) * (e.reliable ? 1 : 0.7);
      const priority = Math.round(raw * 100) / 100;
      const directional = e.measurement === "simulated" ? " (directional — simulated engine)" : "";
      const beaten = pressure > 0
        ? ` Cited instead: ${e.topCompetitors.map((c) => c.domain).slice(0, 3).join(", ")}.`
        : " No competitor dominates yet.";
      return {
        engine: e.engine,
        measurement: e.measurement,
        sampleSize: e.sampleSize,
        reliable: e.reliable,
        citedShare: e.citedShare,
        competitorsCitedThere: e.topCompetitors,
        priority,
        rationale: `Absent across ${e.sampleSize} answer(s) on ${e.engine}${directional}.${beaten}`,
      };
    })
    .sort((a, b) => b.priority - a.priority || a.engine.localeCompare(b.engine));

  const focusEngine = targets[0]?.engine;
  const note = targets.length
    ? `Focus on ${focusEngine} first — ${targets.length} engine(s) where you're absent.`
    : "You're cited on every measured engine — no absent engines to target.";

  return { targets, focusEngine, note };
}
