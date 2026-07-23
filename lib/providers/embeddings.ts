/**
 * EmbeddingProvider (OSI-009) — vectorizes text for the EvidenceIndex vector path.
 *
 *  - `mock`   : deterministic hashed bag-of-tokens vector; zero dependencies (default).
 *  - `local`  : lazy `@xenova/transformers` sentence embeddings (opt-in, offline).
 *  - `openai` : hosted embeddings over fetch (opt-in, key server-only).
 *
 * The mock keeps the vector path *real* (cosine-comparable) without any service,
 * so OpenSearch's vector search is testable end-to-end offline.
 */

export interface EmbeddingProvider {
  readonly source: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Deterministic hashing embedding: stable, cosine-comparable, no dependencies. */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly source = "mock";
  constructor(readonly dimensions = 64) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vec = new Array<number>(this.dimensions).fill(0);
      for (const token of tokenize(text)) {
        let hash = 2166136261;
        for (let i = 0; i < token.length; i++) {
          hash ^= token.charCodeAt(i);
          hash = Math.imul(hash, 16777619);
        }
        vec[Math.abs(hash) % this.dimensions] += 1;
      }
      const norm = Math.hypot(...vec) || 1;
      return vec.map((v) => v / norm);
    });
  }
}

type FeatureExtractor = (t: string, o: unknown) => Promise<{ data: Float32Array }>;

/** Local transformer embeddings (opt-in). Lazy-imported; throws a clear error if absent. */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly source = "local";
  readonly dimensions = 384;
  private extractor: FeatureExtractor | null = null;

  private async pipeline(): Promise<FeatureExtractor> {
    if (this.extractor) return this.extractor;
    const pkg = "@xenova/transformers";
    let mod: { pipeline: (task: string, model: string) => Promise<FeatureExtractor> };
    try {
      mod = (await import(/* webpackIgnore: true */ pkg)) as typeof mod;
    } catch {
      throw new Error("@xenova/transformers is not installed. Set OPENGROWTH_EMBEDDINGS=mock or install it.");
    }
    this.extractor = await mod.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    return this.extractor;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const extractor = await this.pipeline();
    const out: number[][] = [];
    for (const text of texts) {
      const result = await extractor(text, { pooling: "mean", normalize: true });
      out.push(Array.from(result.data));
    }
    return out;
  }
}

/** Hosted embeddings (OpenAI-compatible) over fetch. */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly source = "openai";
  readonly dimensions = 1536;
  constructor(
    private readonly apiKey: string,
    private readonly model = "text-embedding-3-small",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    const res = await this.fetchImpl("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings returned ${res.status}`);
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }
}

export function getEmbeddingProvider(env: Record<string, string | undefined> = process.env): EmbeddingProvider {
  switch (env.OPENGROWTH_EMBEDDINGS) {
    case "local":
      return new LocalEmbeddingProvider();
    case "openai":
      if (env.OPENAI_API_KEY) return new OpenAIEmbeddingProvider(env.OPENAI_API_KEY);
      return new MockEmbeddingProvider();
    default:
      return new MockEmbeddingProvider();
  }
}
