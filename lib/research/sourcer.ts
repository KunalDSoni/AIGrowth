// lib/research/sourcer.ts
import type { Dataset } from "./types";

export interface DatasetProvider {
  fetch(angleId: string): Promise<Dataset>;
}

export function validateProvenance(dataset: Dataset): { ok: boolean; reason: string } {
  if (dataset.provenance.license === "unknown") {
    return { ok: false, reason: "Dataset license is unknown — excluded from any public claim." };
  }
  if (dataset.observations.length === 0) {
    return { ok: false, reason: "Dataset has no observations." };
  }
  return { ok: true, reason: "Provenance and license verified." };
}
