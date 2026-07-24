import { describe, expect, it } from "vitest";
import { recordIntervention } from "@/lib/engines/geo-intervention";
import type { CitationLedger, PromptCitationRecord } from "@/lib/analyze/types";
import type { FixProvenance } from "@/lib/engines/geo-fix-approval";

function rec(promptId: string, over: Partial<PromptCitationRecord> = {}): PromptCitationRecord {
  return {
    promptId,
    prompt: promptId,
    status: "absent",
    brandMentioned: false,
    brandCited: false,
    competitorDomains: [],
    citedSources: [],
    ...over,
  };
}

function ledgerOf(records: PromptCitationRecord[]): CitationLedger {
  const answered = records.filter((r) => r.status !== "unanswered").length;
  return {
    runId: "baseline-run",
    model: "m",
    sampleSize: answered,
    records,
    competitorFrequency: [],
    coverage: { cited: 0, mentionedNotCited: 0, absent: records.length, unanswered: 0 },
    reliable: answered >= 3,
    evidenceIds: [],
  };
}

function provenance(over: Partial<FixProvenance> = {}): FixProvenance {
  return {
    assetId: "brief-fix-faq-block-v1",
    briefId: "brief-fix-faq-block",
    fixId: "fix-faq-block",
    fixTypeId: "faq-block",
    feature: "hasFaqStructure",
    affectedPrompts: ["p1", "p2"],
    evidenceIds: ["ev-1"],
    approvedAt: "2026-07-24T12:00:00.000Z",
    approvedBy: "kunal",
    ...over,
  };
}

const SHIPPED = new Date("2026-07-25T09:00:00Z");

describe("recordIntervention", () => {
  it("records what shipped and a baseline over the affected prompts", () => {
    const ledger = ledgerOf([
      rec("p1"),
      rec("p2", { status: "mentioned-not-cited", brandMentioned: true }),
      rec("p3", { status: "cited", brandCited: true }), // not targeted
    ]);
    const record = recordIntervention({ provenance: provenance(), ledger, shippedAt: SHIPPED });
    expect(record.assetId).toBe("brief-fix-faq-block-v1");
    expect(record.fixId).toBe("fix-faq-block");
    expect(record.affectedPrompts).toEqual(["p1", "p2"]);
    expect(record.shippedAt).toBe("2026-07-25T09:00:00.000Z");
    expect(record.baseline.targetPromptCount).toBe(2);
    expect(record.baseline.answered).toBe(2);
    expect(record.baseline.brandCited).toBe(0);
    expect(record.baseline.citedShare).toBe(0);
  });

  it("computes a non-zero baseline citedShare when some targeted prompts already cite the brand", () => {
    const ledger = ledgerOf([
      rec("p1", { status: "cited", brandCited: true }),
      rec("p2"),
    ]);
    const record = recordIntervention({ provenance: provenance(), ledger, shippedAt: SHIPPED });
    expect(record.baseline.answered).toBe(2);
    expect(record.baseline.brandCited).toBe(1);
    expect(record.baseline.citedShare).toBe(0.5);
  });

  it("excludes unanswered targeted prompts from the baseline denominator", () => {
    const ledger = ledgerOf([
      rec("p1", { status: "unanswered" }),
      rec("p2", { status: "cited", brandCited: true }),
    ]);
    const record = recordIntervention({ provenance: provenance(), ledger, shippedAt: SHIPPED });
    expect(record.baseline.answered).toBe(1);
    expect(record.baseline.citedShare).toBe(1);
  });

  it("yields citedShare 0 when no targeted prompt was answered", () => {
    const ledger = ledgerOf([rec("p1", { status: "unanswered" }), rec("p2", { status: "unanswered" })]);
    const record = recordIntervention({ provenance: provenance(), ledger, shippedAt: SHIPPED });
    expect(record.baseline.answered).toBe(0);
    expect(record.baseline.citedShare).toBe(0);
  });
});
