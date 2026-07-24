import { describe, expect, it } from "vitest";
import {
  buildCorrectionPlaybook,
  approveCorrection,
  PLAYBOOK_VERSION,
} from "@/lib/engines/legibility-playbook";
import type {
  AnswerEngineLensReport,
  AnswerEngineLensItem,
} from "@/lib/engines/legibility-answer-engine-lens";

const item = (over: Partial<AnswerEngineLensItem> = {}): AnswerEngineLensItem => ({
  attribute: "price",
  gapKind: "mismatch",
  machineBelief: "$99",
  truth: "$20",
  impact: 80,
  correctable: true,
  channels: ["on-site-schema"],
  rationale: "x",
  ...over,
});

const report = (items: AnswerEngineLensItem[]): AnswerEngineLensReport => ({
  subject: "Acme",
  items,
  correctableCount: items.filter((i) => i.correctable).length,
});

describe("legibility correction playbook", () => {
  it("exposes a version", () => {
    expect(PLAYBOOK_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("drafts a correction from a correctable, sourced gap", () => {
    const pb = buildCorrectionPlaybook(report([item()]));
    expect(pb.drafts).toHaveLength(1);
    expect(pb.drafts[0].to).toBe("$20");
    expect(pb.drafts[0].from).toBe("$99");
    expect(pb.drafts[0].sourced).toBe(true);
  });

  it("skips an uncorrectable gap with a substantiate-first reason", () => {
    const pb = buildCorrectionPlaybook(report([item({ correctable: false, channels: [] })]));
    expect(pb.drafts).toHaveLength(0);
    expect(pb.skipped[0].reason).toMatch(/substantiate/i);
  });

  it("flags third-party channels with an honest disclaimer", () => {
    const pb = buildCorrectionPlaybook(
      report([item({ channels: ["on-site-schema", "wikidata"] })]),
    );
    expect(pb.drafts[0].touchesThirdParty).toBe(true);
    expect(pb.drafts[0].disclaimer).toMatch(/platform decides/i);
  });

  it("marks owned-only channels as not touching third parties", () => {
    const pb = buildCorrectionPlaybook(report([item({ channels: ["on-site-schema"] })]));
    expect(pb.drafts[0].touchesThirdParty).toBe(false);
    expect(pb.drafts[0].disclaimer).toMatch(/properties you control/i);
  });

  it("carries the fueling study through to the draft", () => {
    const pb = buildCorrectionPlaybook(
      report([item({ channels: ["on-site-schema", "primary-source"], fueledByStudy: "study-1" })]),
    );
    expect(pb.drafts[0].fueledByStudy).toBe("study-1");
  });

  it("approves a sourced draft only with a named approver", () => {
    const pb = buildCorrectionPlaybook(report([item()]));
    const approved = approveCorrection(pb.drafts[0], {
      approvedBy: "kunal@acme.com",
      now: new Date("2026-07-24T00:00:00Z"),
    });
    expect(approved.approvedBy).toBe("kunal@acme.com");
    expect(approved.approvedAt).toBe("2026-07-24T00:00:00.000Z");
  });

  it("refuses approval without an approver identity", () => {
    const pb = buildCorrectionPlaybook(report([item()]));
    expect(() => approveCorrection(pb.drafts[0], { approvedBy: " " })).toThrow(/named approver/i);
  });

  it("notes third-party control in the approval note", () => {
    const pb = buildCorrectionPlaybook(report([item({ channels: ["wikidata"] })]));
    const approved = approveCorrection(pb.drafts[0], { approvedBy: "kunal" });
    expect(approved.note).toMatch(/final call/i);
  });

  it("refuses approval of an unsourced draft", () => {
    // Construct a draft-shaped object that is not sourced.
    const pb = buildCorrectionPlaybook(report([item()]));
    const unsourced = { ...pb.drafts[0], sourced: false };
    expect(() => approveCorrection(unsourced, { approvedBy: "kunal" })).toThrow(/unsourced/i);
  });
});
