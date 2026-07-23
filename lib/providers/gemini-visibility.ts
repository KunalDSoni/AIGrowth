export class GeminiNotConfiguredError extends Error {
  readonly code = "GEMINI_NOT_CONFIGURED";
  constructor() {
    super("GEMINI_API_KEY is not configured");
    this.name = "GeminiNotConfiguredError";
  }
}

export interface GeminiAnswer {
  rawText: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface GeminiVisibilityProviderOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export class GeminiVisibilityProvider {
  readonly name = "gemini" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GeminiVisibilityProviderOptions = {}) {
    const key = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
    if (!key) throw new GeminiNotConfiguredError();
    this.apiKey = key;
    this.model = options.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async answer(prompt: string, opts: { timeoutMs?: number } = {}): Promise<GeminiAnswer> {
    const timeoutMs = opts.timeoutMs ?? 20_000;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const response = await this.fetchImpl(url, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Gemini HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const rawText = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return {
      rawText,
      usage: {
        promptTokens: json.usageMetadata?.promptTokenCount,
        completionTokens: json.usageMetadata?.candidatesTokenCount,
      },
    };
  }
}
