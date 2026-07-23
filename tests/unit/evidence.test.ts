import { describe, expect, it } from "vitest";
import {
  classifyFreshness,
  classifyProvenance,
  classifyStrength,
  summarizeEvidence,
  toEvidenceView,
} from "@/lib/engines/evidence";
import type { EvidenceReference } from "@/lib/domain/types";

const NOW = new Date("2026-07-23T00:00:00.000Z");

function ref(overrides: Partial<EvidenceReference> = {}): EvidenceReference {
  return {
    id: "ev-1",
    organizationId: "org",
    projectId: "proj",
    kind: "CRAWL_OBSERVATION",
    source: "crawl",
    observedAt: "2026-07-20T00:00:00.000Z",
    retrievedAt: "2026-07-20T00:00:00.000Z",
    reliability: "MEDIUM",
    isEstimated: false,
    isSimulated: false,
    summary: "A page observation.",
    ...overrides,
  };
}

describe("classifyStrength", () => {
  it("HIGH reliability observed is strong", () => {
    expect(classifyStrength(ref({ reliability: "HIGH" }))).toBe("strong");
  });
  it("simulated non-high is weak", () => {
    expect(classifyStrength(ref({ isSimulated: true, reliability: "LOW" }))).toBe("weak");
  });
  it("medium + estimated is moderate", () => {
    expect(classifyStrength(ref({ reliability: "MEDIUM", isEstimated: true }))).toBe("moderate");
  });
});

describe("classifyProvenance", () => {
  it("maps kinds and flags to provenance labels", () => {
    expect(classifyProvenance(ref({ isSimulated: true }))).toBe("simulated");
    expect(classifyProvenance(ref({ kind: "AI_INFERENCE" }))).toBe("inferred");
    expect(classifyProvenance(ref({ kind: "USER_SUPPLIED" }))).toBe("user-supplied");
    expect(classifyProvenance(ref({ isEstimated: true }))).toBe("estimated");
    expect(classifyProvenance(ref())).toBe("observed");
  });
});

describe("classifyFreshness", () => {
  it("recent evidence is fresh", () => {
    expect(classifyFreshness(ref({ observedAt: "2026-07-20T00:00:00.000Z" }), NOW).freshness).toBe("fresh");
  });
  it("old evidence is stale", () => {
    expect(classifyFreshness(ref({ observedAt: "2025-01-01T00:00:00.000Z" }), NOW).freshness).toBe("stale");
  });
  it("expired validUntil forces stale", () => {
    expect(classifyFreshness(ref({ validUntil: "2026-07-01T00:00:00.000Z" }), NOW).freshness).toBe("stale");
  });
  it("no timestamp yields unknown", () => {
    const r = ref({ observedAt: undefined, retrievedAt: undefined as unknown as string });
    expect(classifyFreshness(r, NOW).freshness).toBe("unknown");
  });
});

describe("toEvidenceView / summarizeEvidence", () => {
  it("maps kind to a source engine", () => {
    expect(toEvidenceView(ref({ kind: "AI_ANSWER_OBSERVATION" }), NOW).sourceEngine).toBe("AI Visibility Engine");
  });
  it("summarizes counts across references", () => {
    const summary = summarizeEvidence(
      [
        ref({ id: "a", reliability: "HIGH" }),
        ref({ id: "b", isSimulated: true, reliability: "LOW" }),
        ref({ id: "c", observedAt: "2024-01-01T00:00:00.000Z" }),
      ],
      NOW,
    );
    expect(summary.total).toBe(3);
    expect(summary.strong).toBeGreaterThanOrEqual(1);
    expect(summary.simulated).toBe(1);
    expect(summary.stale).toBeGreaterThanOrEqual(1);
  });
});
