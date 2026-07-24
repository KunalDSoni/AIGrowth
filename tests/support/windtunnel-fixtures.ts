// tests/support/windtunnel-fixtures.ts
import type { PersonaResponder } from "@/lib/windtunnel/responder";
import type { EvidenceItem, ForcedChoice, Persona, Stimulus } from "@/lib/windtunnel/types";

export const fixtureEvidence: EvidenceItem[] = [
  { id: "e1", source: "review", segment: "smb", text: "Setup was too slow and confusing", sentiment: "negative" },
  { id: "e2", source: "call_note", segment: "smb", text: "Fast simple onboarding once configured", sentiment: "positive" },
  { id: "e3", source: "review", segment: "smb", text: "I just want it simple and fast", sentiment: "neutral" },
];

function scoreVariant(text: string, vocabulary: string[]): number {
  const lower = text.toLowerCase();
  return vocabulary.reduce((n, word) => (lower.includes(word) ? n + 1 : n), 0);
}

export function createFakeResponder(): PersonaResponder {
  return {
    async respond(persona: Persona, stimulus: Stimulus, _seed: number): Promise<ForcedChoice> {
      let best = stimulus.variants[0];
      let bestScore = -1;
      for (const v of stimulus.variants) {
        const s = scoreVariant(v.text, persona.vocabulary);
        if (s > bestScore) {
          best = v;
          bestScore = s;
        }
      }
      const matched = persona.vocabulary.filter((w) => best.text.toLowerCase().includes(w));
      const objectionsRaised = persona.objections.filter((o) => {
        const token = o.toLowerCase().split(/\s+/)[0] ?? "";
        return token.length > 0 && !best.text.toLowerCase().includes(token);
      });
      return {
        winnerVariantId: best.id,
        reason: matched.length > 0 ? `Speaks to: ${matched.join(", ")}` : "No strong signal; default choice.",
        objectionsRaised,
      };
    },
  };
}
