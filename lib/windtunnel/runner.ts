// lib/windtunnel/runner.ts
import type { Persona, PersonaReaction, Stimulus, ForcedChoice } from "./types";
import type { PersonaResponder } from "./responder";

export async function runWindTunnel(args: {
  personas: Persona[];
  stimulus: Stimulus;
  responder: PersonaResponder;
  samples?: number;
}): Promise<PersonaReaction[]> {
  const samples = args.samples ?? 3;
  const reactions: PersonaReaction[] = [];
  for (const persona of args.personas) {
    const choices: ForcedChoice[] = [];
    for (let s = 0; s < samples; s++) {
      choices.push(await args.responder.respond(persona, args.stimulus, s));
    }
    reactions.push({ personaId: persona.id, segment: persona.segment, choices });
  }
  return reactions;
}
