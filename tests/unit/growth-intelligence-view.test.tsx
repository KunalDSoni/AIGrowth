import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GrowthIntelligenceView } from "@/components/growth-intelligence";
import { emptyPillarSummaries } from "@/lib/engines/growth-intelligence-compose";
import type { GrowthIntelligenceReport } from "@/lib/domain/types";

function report(overrides: Partial<GrowthIntelligenceReport> = {}): GrowthIntelligenceReport {
  return {
    domain: "acme.invalid",
    generatedAt: "2026-07-24T00:00:00.000Z",
    pillars: emptyPillarSummaries().map((p) =>
      p.id === "technical" ? { ...p, signalCount: 3, topSignalTitle: "Title is short" } : p,
    ),
    decisions: [
      {
        id: "d1",
        title: "Publish a citable service page",
        decision: "citation signal ranked #1",
        priorityScore: 82,
        whyNow: "Evidence is strong enough to act.",
        sourceSignals: ["citation"],
        evidenceIds: ["ev-geo"],
        guardrails: ["Do not guarantee rankings, citations, mentions or traffic."],
        nextAction: "Improve a useful first-party source page.",
        measurement: "Track baseline vs comparison window.",
      },
    ],
    guardrails: ["Do not guarantee rankings, citations, mentions or traffic."],
    labels: ["GEO directional only"],
    evidenceIds: ["ev-geo"],
    ...overrides,
  };
}

describe("GrowthIntelligenceView", () => {
  it("renders all six pillar labels", () => {
    render(<GrowthIntelligenceView report={report()} />);
    for (const label of [
      "Search Intelligence",
      "Technical Intelligence",
      "Business Intelligence",
      "Content Intelligence",
      "AI Visibility Intelligence",
      "Marketing Intelligence",
    ]) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it("renders the ranked decision with its next action", () => {
    render(<GrowthIntelligenceView report={report()} />);
    expect(screen.getByText("Publish a citable service page")).toBeDefined();
    expect(screen.getByText(/Improve a useful first-party source page/)).toBeDefined();
  });

  it("surfaces honesty labels", () => {
    render(<GrowthIntelligenceView report={report()} />);
    expect(screen.getByText(/GEO directional only/)).toBeDefined();
  });

  it("shows an empty state when there are no ranked decisions", () => {
    render(<GrowthIntelligenceView report={report({ decisions: [], evidenceIds: [] })} />);
    expect(screen.getByText(/No ranked decisions yet/i)).toBeDefined();
  });
});
