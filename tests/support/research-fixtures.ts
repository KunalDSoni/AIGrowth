// tests/support/research-fixtures.ts
import type { DatasetProvider } from "@/lib/research/sourcer";
import type { CitationGap, Dataset, Observation } from "@/lib/research/types";

export const fixtureGaps: CitationGap[] = [
  { question: "What % of freelancers raise rates yearly?", topic: "freelancing", askVolume: 90, existingSources: 0 },
  { question: "What % use time-tracking tools?", topic: "freelancing", askVolume: 40, existingSources: 3 },
];

function makeObservations(matched: number, total: number): Observation[] {
  return Array.from({ length: total }, (_, i) => ({ matched: i < matched }));
}

export function fixtureDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    id: "ds1",
    provenance: { source: "OpenSurvey 2026", license: "cc_by", retrievedAt: "2026-01-01T00:00:00.000Z" },
    observations: makeObservations(62, 100), // 62%
    population: "freelancers",
    sampleFrame: "OpenSurvey panel",
    ...overrides,
  };
}

export function createFixtureProvider(dataset: Dataset): DatasetProvider {
  return {
    async fetch() {
      return dataset;
    },
  };
}
