// lib/causal/ledger.ts
import type { Intervention } from "./types";

export interface InterventionLedger {
  record(intervention: Intervention): void;
  list(): Intervention[];
  get(id: string): Intervention | undefined;
}

export function createInMemoryLedger(seed: Intervention[] = []): InterventionLedger {
  const items = new Map<string, Intervention>(seed.map((i) => [i.id, i]));
  return {
    record: (i) => {
      items.set(i.id, i);
    },
    list: () => [...items.values()],
    get: (id) => items.get(id),
  };
}
