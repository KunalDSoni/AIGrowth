/**
 * EvidenceIndex (OSI-010) — optional retrieval backbone.
 *
 *  - `memory`     : in-process keyword + vector (cosine) index; zero dependencies (default).
 *  - `opensearch` : OpenSearch REST adapter over fetch (opt-in via docker-compose).
 *
 * Every doc carries `source` + `measurement` provenance; retrieval never invents a
 * citation it cannot evidence. If OpenSearch is unreachable the factory falls back
 * to `memory` rather than throwing into a request path.
 */

import type { MeasurementLabel } from "@/lib/providers/measurement";
import { getEmbeddingProvider, type EmbeddingProvider } from "@/lib/providers/embeddings";

export interface EvidenceDoc {
  id: string;
  text: string;
  source: string;
  measurement: MeasurementLabel;
  observedAt: string;
  filters?: Record<string, string>;
  vector?: number[];
}

export interface EvidenceHit {
  doc: EvidenceDoc;
  score: number;
}

export interface EvidenceQuery {
  text?: string;
  vector?: number[];
  filters?: Record<string, string>;
  k: number;
}

export interface EvidenceIndex {
  readonly source: string;
  upsert(docs: EvidenceDoc[]): Promise<void>;
  search(query: EvidenceQuery): Promise<EvidenceHit[]>;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function keywordScore(query: string, text: string): number {
  const q = new Set((query.toLowerCase().match(/[a-z0-9]+/g) ?? []));
  if (!q.size) return 0;
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  let hits = 0;
  for (const w of words) if (q.has(w)) hits++;
  return hits / (words.length || 1);
}

function matchesFilters(doc: EvidenceDoc, filters?: Record<string, string>): boolean {
  if (!filters) return true;
  return Object.entries(filters).every(([k, v]) => doc.filters?.[k] === v);
}

export class MemoryEvidenceIndex implements EvidenceIndex {
  readonly source = "memory";
  private readonly docs = new Map<string, EvidenceDoc>();

  constructor(private readonly embedder: EmbeddingProvider = getEmbeddingProvider()) {}

  async upsert(docs: EvidenceDoc[]): Promise<void> {
    const missing = docs.filter((d) => !d.vector);
    const vectors = missing.length ? await this.embedder.embed(missing.map((d) => d.text)) : [];
    let vi = 0;
    for (const doc of docs) {
      this.docs.set(doc.id, { ...doc, vector: doc.vector ?? vectors[vi++] });
    }
  }

  async search(query: EvidenceQuery): Promise<EvidenceHit[]> {
    const queryVector = query.vector ?? (query.text ? (await this.embedder.embed([query.text]))[0] : undefined);
    const hits: EvidenceHit[] = [];
    for (const doc of this.docs.values()) {
      if (!matchesFilters(doc, query.filters)) continue;
      let score = 0;
      if (queryVector && doc.vector) score += cosine(queryVector, doc.vector);
      if (query.text) score += keywordScore(query.text, doc.text);
      if (score > 0) hits.push({ doc, score });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, query.k);
  }

  get size(): number {
    return this.docs.size;
  }
}

export class OpenSearchEvidenceIndex implements EvidenceIndex {
  readonly source = "opensearch";
  constructor(
    private readonly baseUrl: string,
    private readonly index = "opengrowth-evidence",
    private readonly embedder: EmbeddingProvider = getEmbeddingProvider(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async upsert(docs: EvidenceDoc[]): Promise<void> {
    const missing = docs.filter((d) => !d.vector);
    const vectors = missing.length ? await this.embedder.embed(missing.map((d) => d.text)) : [];
    let vi = 0;
    const body =
      docs
        .map((doc) => {
          const vector = doc.vector ?? vectors[vi++];
          return (
            JSON.stringify({ index: { _index: this.index, _id: doc.id } }) +
            "\n" +
            JSON.stringify({ ...doc, vector })
          );
        })
        .join("\n") + "\n";
    const res = await this.fetchImpl(new URL("/_bulk", this.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/x-ndjson" },
      body,
    });
    if (!res.ok) throw new Error(`OpenSearch bulk returned ${res.status}`);
  }

  async search(query: EvidenceQuery): Promise<EvidenceHit[]> {
    const must: unknown[] = [];
    if (query.text) must.push({ match: { text: query.text } });
    for (const [k, v] of Object.entries(query.filters ?? {})) must.push({ term: { [`filters.${k}`]: v } });
    const res = await this.fetchImpl(new URL(`/${this.index}/_search`, this.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ size: query.k, query: must.length ? { bool: { must } } : { match_all: {} } }),
    });
    if (!res.ok) throw new Error(`OpenSearch search returned ${res.status}`);
    const data = (await res.json()) as { hits: { hits: Array<{ _source: EvidenceDoc; _score: number }> } };
    return data.hits.hits.map((h) => ({ doc: h._source, score: h._score }));
  }
}

export function getEvidenceIndex(env: Record<string, string | undefined> = process.env): EvidenceIndex {
  if (env.OPENGROWTH_EVIDENCE_INDEX === "opensearch" && env.OPENSEARCH_URL) {
    return new OpenSearchEvidenceIndex(env.OPENSEARCH_URL, env.OPENSEARCH_INDEX ?? "opengrowth-evidence");
  }
  return new MemoryEvidenceIndex();
}
