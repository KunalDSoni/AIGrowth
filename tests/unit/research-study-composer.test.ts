import { describe, expect, it } from "vitest";
import {
  composeStudy,
  publishStudy,
  STUDY_COMPOSER_VERSION,
  type Study,
} from "@/lib/engines/research-study-composer";
import type { StatFinding } from "@/lib/engines/research-analysis";
import type { SourcedDataset } from "@/lib/engines/research-data-sourcer";
import type { MethodologyVerdict } from "@/lib/engines/research-methodology-guard";

const finding = (over: Partial<StatFinding> = {}): StatFinding => ({
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
  ...over,
});

const dataset = (over: Partial<SourcedDataset> = {}): SourcedDataset => ({
  id: "d1",
  title: "Rate postings 2026",
  origin: "public",
  source: "data.gov",
  url: "https://data.gov/x",
  license: "cc-by-4.0",
  recordCount: 5000,
  retrievedAt: "2026-07-24T00:00:00.000Z",
  provenance: "Public dataset from data.gov under cc-by-4.0, retrieved 2026-07-24.",
  ...over,
});

const verdict = (over: Partial<MethodologyVerdict> = {}): MethodologyVerdict => ({
  strength: "supported",
  publishable: true,
  checks: [],
  statement: "Method (pre-registered 2026-07-24): public rate-card synthesis. Supported.",
  blockedReasons: [],
  ...over,
});

const baseInput = () => ({
  id: "study-1",
  title: "2026 Freelance Rate Report",
  brand: "Acme",
  anglePromptId: "p1",
  findings: [finding()],
  methodology: verdict(),
  datasets: [dataset()],
});

describe("research study composer", () => {
  it("exposes a version", () => {
    expect(STUDY_COMPOSER_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("composes a draft (never auto-published) with a headline and provenance", () => {
    const s = composeStudy(baseInput());
    expect(s.status).toBe("draft");
    expect(s.headline?.id).toBe("f1");
    expect(s.publishable).toBe(true);
    expect(s.datasets).toHaveLength(1);
  });

  it("excludes insufficient findings from the study, with a reason", () => {
    const s = composeStudy({
      ...baseInput(),
      findings: [finding(), finding({ id: "weak", strength: "insufficient" })],
    });
    expect(s.findings.map((f) => f.id)).toEqual(["f1"]);
    expect(s.excludedFindings.map((e) => e.id)).toEqual(["weak"]);
  });

  it("is not publishable when methodology is not publishable", () => {
    const s = composeStudy({
      ...baseInput(),
      methodology: verdict({ publishable: false, strength: "insufficient" }),
    });
    expect(s.publishable).toBe(false);
  });

  it("is not publishable when every finding was excluded", () => {
    const s = composeStudy({
      ...baseInput(),
      findings: [finding({ strength: "insufficient" })],
    });
    expect(s.headline).toBeUndefined();
    expect(s.publishable).toBe(false);
    expect(s.strength).toBe("insufficient");
  });

  it("picks the strongest, largest-sample finding as headline", () => {
    const s = composeStudy({
      ...baseInput(),
      findings: [
        finding({ id: "dir", strength: "directional", n: 500 }),
        finding({ id: "sup", strength: "supported", n: 200 }),
      ],
    });
    expect(s.headline?.id).toBe("sup");
  });

  it("emits schema.org/Dataset markup carrying n/source/method on every stat", () => {
    const s = composeStudy(baseInput());
    const markup = s.datasetMarkup as Record<string, unknown>;
    expect(markup["@type"]).toBe("Dataset");
    expect(markup["name"]).toBe("2026 Freelance Rate Report");
    expect(markup["license"]).toEqual(["cc-by-4.0"]);
    const vars = markup["variableMeasured"] as Array<Record<string, unknown>>;
    expect(vars).toHaveLength(1);
    expect(vars[0]["measurementTechnique"]).toBe("public rate-card synthesis");
    expect(String(vars[0]["description"])).toMatch(/n=200/);
  });

  it("publishes a draft only with a named approver, stamping datePublished", () => {
    const draft = composeStudy(baseInput());
    const pub = publishStudy(draft, { approvedBy: "kunal@acme.com", now: new Date("2026-07-24T12:00:00Z") });
    expect(pub.study.status).toBe("published");
    expect(pub.publishedBy).toBe("kunal@acme.com");
    expect((pub.study.datasetMarkup as Record<string, unknown>)["datePublished"]).toBe(
      "2026-07-24T12:00:00.000Z",
    );
  });

  it("refuses to publish without an approver identity", () => {
    const draft = composeStudy(baseInput());
    expect(() => publishStudy(draft, { approvedBy: "  " })).toThrow(/named approver/i);
  });

  it("refuses to publish a non-publishable study", () => {
    const draft: Study = composeStudy({
      ...baseInput(),
      findings: [finding({ strength: "insufficient" })],
    });
    expect(() => publishStudy(draft, { approvedBy: "kunal" })).toThrow(/no defensible finding/i);
  });

  it("refuses to re-publish an already-published study", () => {
    const draft = composeStudy(baseInput());
    const pub = publishStudy(draft, { approvedBy: "kunal" });
    expect(() => publishStudy(pub.study, { approvedBy: "kunal" })).toThrow(/already published/i);
  });
});
