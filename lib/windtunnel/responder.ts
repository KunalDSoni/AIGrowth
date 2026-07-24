// lib/windtunnel/responder.ts
import type { ForcedChoice, Persona, Stimulus } from "./types";

export interface PersonaResponder {
  respond(persona: Persona, stimulus: Stimulus, sampleSeed: number): Promise<ForcedChoice>;
}
