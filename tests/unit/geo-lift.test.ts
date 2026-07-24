import { describe, expect, it } from "vitest";
import { attributeLift } from "@/lib/engines/geo-lift";
import type { InterventionRecord } from "@/lib/engines/geo-intervention";
import type { CitationLedger, PromptCitationRecord } from "@/lib/analyze/types";

function rec(promptId: string, cited: boolean, unanswered = false): PromptCitationRecord {
  return {
    promptId,
    prompt: promptId,
    status: unanswered ? "unanswered" : cited ? "cited" : "absent",
    brandMentioned: false,
    brandCited: cited,
    competitorDomains: [],
    citedSources: [],
  };
}

function ledgerOf(records: PromptCitationRecord[]): CitationLedger {
  return {
    runId: "post-run",
    model: "m",
    sampleSize: records.filter((r) => r.status !== "unanswered").length,
    records,
    competitorFrequency: [],
    coverage: { cited: 0, mentionedNotCited: 0, absent: 0, unanswered: 0 },
    reliable: true,
    evidenceIds: [],
  };
}

function intervention(baseline: { answered: number; brandCited: number }): InterventionRecord {
  return {
    id: "intervention-1",
    assetId: "asset-1",
    fixId: "fix-faq-block",
    fixTypeId: "faq-block",
    feature: "hasFaqStructure",
    affectedPrompts: ["p1", "p2", "p3", "p4"],
    shippedAt: "2026-07-25T09:00:00.000Z",
    baseline: {
      runId: "baseline-run",
      targetPromptCount: 4,
      answered: baseline.answered,
      brandCited: baseline.brandCited,
      citedShare: baseline.answered ? Math.round((baseline.brandCited / baseline.answered) * 100) / 100 : 0,
    },
  };
}

const post = (cited: number) =>
  ledgerOf(["p1", "p2", "p3", "p4"].map((p, i) => rec(p, i < cited)));

describe("attributeLift", () => {
  it("labels a significant change with a control as causal", () => {
    const lift = attributeLift({
      intervention: intervention({ answered: 4, brandCited: 0 }),
      postLedger: post(4),
      controlled: true,
    });
    expect(lift.significant).toBe(true);
    expect(lift.label).toBe("causal");
    expect(lift.deltaShare).toBe(1);
  });

  it("labels a significant change without a control as directional", () => {
    const lift = attributeLift({
      intervention: intervention({ answered: 4, brandCited: 0 }),
      postLedger: post(4),
    });
    expect(lift.label).toBe("directional");
    expect(lift.note.toLowerCase()).toContain("not proven causal");
  });

  it("labels a non-significant change as insufficient", () => {
    const lift = attributeLift({
      intervention: intervention({ answered: 4, brandCited: 2 }),
      postLedger: post(2),
      controlled: true,
    });
    expect(lift.significant).toBe(false);
    expect(lift.label).toBe("insufficient");
    expect(lift.note.toLowerCase()).toContain("not statistically significant");
  });

  it("labels a small sample as insufficient regardless of direction", () => {
    const smallPost = ledgerOf([rec("p1", true), rec("p2", true, true)]);
    const lift = attributeLift({
      intervention: intervention({ answered: 1, brandCited: 0 }),
      postLedger: smallPost,
      controlled: true,
    });
    expect(lift.label).toBe("insufficient");
    expect(lift.note.toLowerCase()).toContain("too small");
  });

  it("reports the post citation share and a confidence interval", () => {
    const lift = attributeLift({
      intervention: intervention({ answered: 4, brandCited: 0 }),
      postLedger: post(3),
    });
    expect(lift.post.answered).toBe(4);
    expect(lift.post.brandCited).toBe(3);
    expect(lift.post.citedShare).toBe(0.75);
    expect(lift.postInterval).not.toBeNull();
  });
});
