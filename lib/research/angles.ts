// lib/research/angles.ts
import type { CitationGap, StudyAngle } from "./types";

export function findAngles(gaps: CitationGap[]): StudyAngle[] {
  return gaps
    .map((g, i) => ({
      id: `angle_${i}`,
      question: g.question,
      topic: g.topic,
      citationPotential: g.askVolume / (g.existingSources + 1),
      rationale: `Asked ~${g.askVolume}x with ${g.existingSources} credible source(s) — ${
        g.existingSources === 0 ? "open whitespace" : "under-served"
      }.`,
    }))
    .sort((a, b) => b.citationPotential - a.citationPotential);
}
