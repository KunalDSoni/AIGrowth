import { describe, expect, it } from "vitest";
import { runMultiEngineProbes, type EngineSpec } from "@/lib/engines/geo-multi-engine";
import type { AnswerEngineProvider } from "@/lib/providers/answer-engine";

function eng(name: string, behavior: (p: string) => { answer?: string; url?: string } | Error): AnswerEngineProvider {
  return {
    engines: [name],
    async ask(prompt) {
      const out = behavior(prompt);
      if (out instanceof Error) throw out;
      return {
        prompt,
        answer: out.answer ?? "",
        citations: out.url ? [{ url: out.url }] : [],
        engine: name,
        source: name,
        measurement: "measured",
        measuredAt: "2026-07-24T00:00:00Z",
      };
    },
  };
}

const spec = (name: string, provider: AnswerEngineProvider): EngineSpec => ({ name, provider, measurement: "measured" });

describe("runMultiEngineProbes", () => {
  it("produces one result per engine and isolates a failing engine", async () => {
    const results = await runMultiEngineProbes({
      engines: [
        spec("cites", eng("cites", () => ({ answer: "Brand (brand.invalid) is great.", url: "https://brand.invalid/x" }))),
        spec("absent", eng("absent", () => ({ answer: "Use someone else.", url: "https://rival.example/x" }))),
        spec("broken", eng("broken", () => new Error("engine down"))),
      ],
      prompts: ["p1", "p2", "p3"],
      brandGuess: "Brand",
      domain: "brand.invalid",
    });

    expect(results.map((r) => r.engine)).toEqual(["cites", "absent", "broken"]);

    const cites = results.find((r) => r.engine === "cites")!;
    expect(cites.geo.sampleSize).toBe(3);
    expect(cites.measurement).toBe("measured");

    const absent = results.find((r) => r.engine === "absent")!;
    expect(absent.geo.sampleSize).toBe(3);
    expect(absent.geo.observations.every((o) => !o.brandMentioned)).toBe(true);

    // A per-probe throw is caught by runGeoProbes → every probe failed → sampleSize 0.
    const broken = results.find((r) => r.engine === "broken")!;
    expect(broken.geo.sampleSize).toBe(0);
  });

  it("returns results for a single engine", async () => {
    const results = await runMultiEngineProbes({
      engines: [spec("only", eng("only", () => ({ answer: "x" })))],
      prompts: ["p1"],
      brandGuess: "Brand",
      domain: "brand.invalid",
    });
    expect(results).toHaveLength(1);
    expect(results[0].engine).toBe("only");
  });
});
