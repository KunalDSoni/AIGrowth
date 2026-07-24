import { describe, expect, it } from "vitest";
import {
  buildResearchPlan,
  studyToEntityFact,
  RESEARCH_ENGINE_VERSION,
} from "@/lib/engines/research-engine";
import { composeStudy, publishStudy } from "@/lib/engines/research-study-composer";
import type {
  CitationLedger,
  PromptCitationRecord,
  PromptCitationStatus,
} from "@/lib/analyze/types";
import type { StatFinding } from "@/lib/engines/research-analysis";
import type { MethodologyVerdict } from "@/lib/engines/research-methodology-guard";

const rec = (
  promptId: string,
  prompt: string,
  status: PromptCitationStatus,
): PromptCitationRecord => ({
  promptId,
  prompt,
  status,
  brandMentioned: false,
  brandCited: status === "cited",
  competitorDomains: [],
  citedSources: [],
});

const ledger = (records: PromptCitationRecord[]): CitationLedger => ({
  runId: "r1",
  model: "mock",
  sampleSize: records.length,
  records,
  competitorFrequency: [],
  coverage: { cited: 0, mentionedNotCited: 0, absent: 0, unanswered: 0 },
  reliable: true,
  evidenceIds: [],
});

const finding = (): StatFinding => ({
  id: "f1",
  kind: "proportion",
  headline: "62% raised rates (n=200)",
  value: 62,
  unit: "percent",
  interval: { low: 55, high: 69, method: "wilson" },
  n: 200,
  sources: ["data.gov"],
  method: "public rate-card synthesis",
  strength: "supported",
});

const verdict: MethodologyVerdict = {
  strength: "supported",
  publishable: true,
  checks: [],
  statement: "Method: public rate-card synthesis. Supported.",
  blockedReasons: [],
};

const publishedStudy = () => {
  const draft = composeStudy({
    id: "study-1",
    title: "2026 Freelance Rate Report",
    brand: "Acme",
    anglePromptId: "p1",
    findings: [finding()],
    methodology: verdict,
    datasets: [],
  });
  return publishStudy(draft, { approvedBy: "kunal" }).study;
};

describe("research engine orchestration", () => {
  it("exposes a version", () => {
    expect(RESEARCH_ENGINE_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("builds a plan of ranked angles from a live ledger", () => {
    const plan = buildResearchPlan(
      ledger([rec("p1", "What percentage of freelancers raised rates?", "absent")]),
      { now: "2026-07-24T00:00:00.000Z" },
    );
    expect(plan.angles).toHaveLength(1);
    expect(plan.generatedAt).toBe("2026-07-24T00:00:00.000Z");
  });

  it("reports canCompose false with an honest note when no licensed data is present", () => {
    const plan = buildResearchPlan(
      ledger([rec("p1", "How much do freelancers charge?", "absent")]),
    );
    expect(plan.canCompose).toBe(false);
    expect(plan.note).toMatch(/licensed datasets/i);
  });

  it("notes the empty state when there are no angles", () => {
    const plan = buildResearchPlan(ledger([rec("p1", "Best invoicing tool?", "absent")]));
    expect(plan.angles).toHaveLength(0);
    expect(plan.note).toMatch(/no citable angles/i);
  });

  it("converts a published study into a sourced entity fact for Frontier 4", () => {
    const fact = studyToEntityFact(publishedStudy());
    expect(fact.subject).toBe("Acme");
    expect(fact.value).toBe(62);
    expect(fact.strength).toBe("supported");
    expect(fact.provenance).toMatch(/public rate-card synthesis/);
    expect(fact.sourceStudyId).toBe("study-1");
  });

  it("refuses to derive an entity fact from an unpublished draft", () => {
    const draft = composeStudy({
      id: "study-2",
      title: "x",
      brand: "Acme",
      anglePromptId: "p1",
      findings: [finding()],
      methodology: verdict,
      datasets: [],
    });
    expect(() => studyToEntityFact(draft)).toThrow(/published/i);
  });
});
