import { describe, expect, it } from "vitest";
import {
  applyConfirmation,
  buildBusinessGraph,
  factWeight,
  pendingReview,
  rankedEntities,
} from "@/lib/engines/business-graph";
import type { BusinessProfileSnapshot, WebsitePageProfile } from "@/lib/domain/types";

const business: BusinessProfileSnapshot = {
  id: "acme",
  name: "Acme",
  market: "Australia",
  industry: "Accounting",
  goal: "Qualified leads",
  audienceSegments: ["Clinics", "E-commerce"],
  services: ["Bookkeeping", "Payroll"],
  differentiators: ["Plain-language advice"],
  tone: "Warm",
};

const pages: WebsitePageProfile[] = [
  { id: "p1", url: "/cfo", title: "Virtual CFO", pageType: "service", services: ["Virtual CFO"], audiences: ["Clinics"], funnelStage: "Decision" },
];

describe("buildBusinessGraph", () => {
  it("marks profile facts as user-supplied and page-only facts as inferred", () => {
    const graph = buildBusinessGraph({ business, pages, competitors: ["Rival"], profileEvidenceId: "ev-1" });

    const bookkeeping = graph.entities.find((e) => e.label === "Bookkeeping");
    expect(bookkeeping?.status).toBe("user-supplied");
    expect(bookkeeping?.evidenceIds).toContain("ev-1");

    const cfo = graph.entities.find((e) => e.label === "Virtual CFO");
    expect(cfo?.status).toBe("ai-inferred");

    const rival = graph.entities.find((e) => e.type === "competitor");
    expect(rival?.status).toBe("ai-inferred");
  });

  it("connects services to audiences, geography and the goal", () => {
    const graph = buildBusinessGraph({ business, pages });
    const serves = graph.relationships.filter((r) => r.kind === "serves");
    const operatesIn = graph.relationships.filter((r) => r.kind === "operates-in");
    expect(serves.length).toBeGreaterThan(0);
    expect(operatesIn.length).toBeGreaterThan(0);
    expect(graph.relationships.some((r) => r.kind === "targets-goal")).toBe(true);
  });
});

describe("assumption confirmation (BIZ-002)", () => {
  it("confirming an inferred fact raises confidence and produces an audit event", () => {
    const graph = buildBusinessGraph({ business, pages });
    const cfo = graph.entities.find((e) => e.label === "Virtual CFO")!;
    const result = applyConfirmation(graph, { entityId: cfo.id, action: "confirm", at: "2026-07-23" });

    const updated = result.graph.entities.find((e) => e.id === cfo.id)!;
    expect(updated.status).toBe("confirmed");
    expect(updated.confidence).toBe(100);
    expect(result.audit).toContain("confirm");
  });

  it("rejecting a fact zeroes its weight and removes it from ranking", () => {
    const graph = buildBusinessGraph({ business, pages });
    const cfo = graph.entities.find((e) => e.label === "Virtual CFO")!;
    const { graph: next } = applyConfirmation(graph, { entityId: cfo.id, action: "reject", at: "2026-07-23" });
    expect(rankedEntities(next, "service").some((e) => e.label === "Virtual CFO")).toBe(false);
  });

  it("editing a fact updates the label and confirms it", () => {
    const graph = buildBusinessGraph({ business, pages });
    const cfo = graph.entities.find((e) => e.label === "Virtual CFO")!;
    const { graph: next } = applyConfirmation(graph, { entityId: cfo.id, action: "edit", label: "Outsourced CFO", at: "2026-07-23" });
    const updated = next.entities.find((e) => e.id === cfo.id)!;
    expect(updated.label).toBe("Outsourced CFO");
    expect(updated.status).toBe("confirmed");
  });

  it("confirmed facts outrank inferred facts of the same type", () => {
    const graph = buildBusinessGraph({ business, pages });
    const cfo = graph.entities.find((e) => e.label === "Virtual CFO")!;
    const { graph: next } = applyConfirmation(graph, { entityId: cfo.id, action: "confirm", at: "2026-07-23" });
    const ranked = rankedEntities(next, "service");
    expect(ranked[0].label).toBe("Virtual CFO");
  });

  it("factWeight orders confirmed above inferred above rejected", () => {
    expect(factWeight("confirmed")).toBeGreaterThan(factWeight("ai-inferred"));
    expect(factWeight("ai-inferred")).toBeGreaterThan(factWeight("rejected"));
  });

  it("pendingReview surfaces only inferred facts", () => {
    const graph = buildBusinessGraph({ business, pages, competitors: ["Rival"] });
    const pending = pendingReview(graph);
    expect(pending.every((e) => e.status === "ai-inferred")).toBe(true);
    expect(pending.some((e) => e.label === "Virtual CFO")).toBe(true);
  });
});
