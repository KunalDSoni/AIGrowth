// lib/windtunnel/distiller.ts
import type { EvidenceItem, Persona, SegmentId } from "./types";

export interface PersonaDistiller {
  distill(evidence: EvidenceItem[]): Persona[];
}

export const MIN_EVIDENCE_PER_PERSONA = 2;

function tokens(texts: string[]): string[] {
  const seen = new Set<string>();
  for (const t of texts) {
    for (const raw of t.toLowerCase().split(/[^a-z]+/)) {
      if (raw.length >= 4) seen.add(raw);
    }
  }
  return [...seen];
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

export function createHeuristicDistiller(): PersonaDistiller {
  return {
    distill(evidence) {
      const bySegment = new Map<SegmentId, EvidenceItem[]>();
      for (const item of evidence) {
        const seg = item.segment ?? "general";
        const list = bySegment.get(seg) ?? [];
        list.push(item);
        bySegment.set(seg, list);
      }

      const personas: Persona[] = [];
      for (const [segment, items] of bySegment) {
        if (items.length < MIN_EVIDENCE_PER_PERSONA) continue;
        personas.push({
          id: `persona_${segment}`,
          segment,
          objections: unique(items.filter((i) => i.sentiment === "negative").map((i) => i.text)),
          jobsToBeDone: unique(items.filter((i) => i.sentiment === "positive").map((i) => i.text)),
          vocabulary: tokens(items.map((i) => i.text)),
          quoteIds: items.map((i) => i.id),
        });
      }
      return personas;
    },
  };
}
