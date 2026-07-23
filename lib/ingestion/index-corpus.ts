/**
 * Evidence corpus indexing (OSI-011 / MDM-007).
 *
 * Converts crawled pages, GEO observations, and answer-engine observations into
 * EvidenceDocs and upserts them into the EvidenceIndex. Every doc keeps its
 * source + measurement provenance so retrieval stays auditable.
 */

import type { CrawledPageEvidence } from "@/lib/domain/types";
import type { EvidenceDoc, EvidenceIndex } from "@/lib/providers/evidence-index";
import type { AnswerObservation } from "@/lib/providers/answer-engine";

export function pageToDoc(page: CrawledPageEvidence, source = "crawl", measurement: EvidenceDoc["measurement"] = "measured"): EvidenceDoc {
  const headings = page.headings.map((h) => h.text).join(" ");
  return {
    id: `page:${page.finalUrl || page.url}`,
    text: [page.title, page.description, headings].filter(Boolean).join(" \n "),
    source,
    measurement,
    observedAt: page.observedAt,
    filters: { kind: "page", url: page.finalUrl || page.url },
  };
}

export interface GeoObservationLike {
  id: string;
  prompt: string;
  rawResponse: string;
}

export function geoObservationToDoc(obs: GeoObservationLike, source = "geo-probe"): EvidenceDoc {
  return {
    id: `geo:${obs.id}`,
    text: `${obs.prompt}\n${obs.rawResponse}`,
    source,
    measurement: "simulated",
    observedAt: new Date().toISOString(),
    filters: { kind: "geo-observation" },
  };
}

export function answerObservationToDoc(obs: AnswerObservation): EvidenceDoc {
  return {
    id: `answer:${obs.engine}:${obs.measuredAt}:${obs.prompt.slice(0, 40)}`,
    text: `${obs.prompt}\n${obs.answer}`,
    source: obs.source,
    measurement: obs.measurement,
    observedAt: obs.measuredAt,
    filters: { kind: "answer-observation", engine: obs.engine },
  };
}

export interface CorpusInput {
  pages?: CrawledPageEvidence[];
  geoObservations?: GeoObservationLike[];
  answers?: AnswerObservation[];
  pageSource?: string;
  pageMeasurement?: EvidenceDoc["measurement"];
}

export async function indexCorpus(index: EvidenceIndex, input: CorpusInput): Promise<number> {
  const docs: EvidenceDoc[] = [
    ...(input.pages ?? []).map((p) => pageToDoc(p, input.pageSource, input.pageMeasurement)),
    ...(input.geoObservations ?? []).map((o) => geoObservationToDoc(o)),
    ...(input.answers ?? []).map(answerObservationToDoc),
  ];
  if (docs.length) await index.upsert(docs);
  return docs.length;
}
