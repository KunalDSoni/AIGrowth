import { describe, expect, it } from "vitest";
import {
  findStudyAngles,
  ANGLE_FINDER_VERSION,
} from "@/lib/engines/research-angle-finder";
import type {
  CitationLedger,
  PromptCitationRecord,
  PromptCitationStatus,
} from "@/lib/analyze/types";

const rec = (
  promptId: string,
  prompt: string,
  status: PromptCitationStatus,
  competitorDomains: string[] = [],
): PromptCitationRecord => ({
  promptId,
  prompt,
  status,
  brandMentioned: status === "mentioned-not-cited" || status === "cited",
  brandCited: status === "cited",
  competitorDomains,
  citedSources: [],
});

const ledger = (records: PromptCitationRecord[]): CitationLedger => ({
  runId: "run-1",
  model: "mock",
  sampleSize: records.filter((r) => r.status !== "unanswered").length,
  records,
  competitorFrequency: [],
  coverage: { cited: 0, mentionedNotCited: 0, absent: 0, unanswered: 0 },
  reliable: true,
  evidenceIds: [],
});

describe("research angle finder", () => {
  it("exposes a version", () => {
    expect(ANGLE_FINDER_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("surfaces a quantitative, uncontested, absent prompt as an angle", () => {
    const angles = findStudyAngles(
      ledger([rec("p1", "What percentage of freelancers raised their rates in 2026?", "absent")]),
    );
    expect(angles).toHaveLength(1);
    expect(angles[0].promptId).toBe("p1");
    expect(angles[0].citationPotential).toBeGreaterThan(0);
  });

  it("excludes prompts with no data intent", () => {
    const angles = findStudyAngles(
      ledger([rec("p1", "What is the best invoicing tool for designers?", "absent")]),
    );
    expect(angles).toHaveLength(0);
  });

  it("excludes prompts the brand already owns the citation for", () => {
    const angles = findStudyAngles(
      ledger([rec("p1", "What is the average hourly rate for freelancers?", "cited")]),
    );
    expect(angles).toHaveLength(0);
  });

  it("ranks an uncontested absent angle above a heavily contested one", () => {
    const angles = findStudyAngles(
      ledger([
        rec("contested", "How much do freelancers charge per hour?", "absent", ["a.com", "b.com", "c.com", "d.com"]),
        rec("open", "What percentage of freelancers use AI tools?", "absent", []),
      ]),
    );
    expect(angles.map((a) => a.promptId)).toEqual(["open", "contested"]);
    expect(angles[0].contested).toBe(0);
  });

  it("scores an absent prompt above an equivalent mentioned-not-cited prompt", () => {
    const angles = findStudyAngles(
      ledger([
        rec("absent", "What is the average project budget for SMBs?", "absent"),
        rec("mentioned", "What is the average project budget for startups?", "mentioned-not-cited"),
      ]),
    );
    const absent = angles.find((a) => a.promptId === "absent")!;
    const mentioned = angles.find((a) => a.promptId === "mentioned")!;
    expect(absent.citationPotential).toBeGreaterThan(mentioned.citationPotential);
  });

  it("respects the limit option", () => {
    const angles = findStudyAngles(
      ledger([
        rec("p1", "How much do agencies charge?", "absent"),
        rec("p2", "What percentage of agencies are remote?", "absent"),
        rec("p3", "What is the average agency headcount?", "absent"),
      ]),
      { limit: 2 },
    );
    expect(angles).toHaveLength(2);
  });

  it("returns an empty list for an empty ledger", () => {
    expect(findStudyAngles(ledger([]))).toEqual([]);
  });

  it("carries a rationale on every angle", () => {
    const angles = findStudyAngles(
      ledger([rec("p1", "What percentage of freelancers raised rates?", "absent")]),
    );
    expect(angles[0].rationale.length).toBeGreaterThan(0);
    expect(angles[0].rationale).toMatch(/citation/i);
  });
});
