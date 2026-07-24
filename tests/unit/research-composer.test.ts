// tests/unit/research-composer.test.ts
import { describe, expect, it } from "vitest";
import { composeStudy, datasetSchema } from "@/lib/research/composer";
import { analyze } from "@/lib/research/analysis";
import { checkSupport, preRegister } from "@/lib/research/methodology";
import { fixtureDataset } from "@/tests/support/research-fixtures";
import type { StudyAngle } from "@/lib/research/types";

const angle: StudyAngle = { id: "angle_0", question: "What % raise rates?", topic: "freelancing", citationPotential: 90, rationale: "x" };
const method = preRegister("What % raise rates?", "rate_raisers", 30, "2026-01-01T00:00:00.000Z");

describe("datasetSchema", () => {
  it("emits schema.org/Dataset JSON-LD", () => {
    const schema = datasetSchema(analyze(fixtureDataset(), method));
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Dataset");
    expect(schema["variableMeasured"]).toBeDefined();
  });
});

describe("composeStudy", () => {
  it("keeps the finding when supported and stays a draft", () => {
    const dataset = fixtureDataset();
    const check = checkSupport(dataset, method);
    const study = composeStudy({ angle, methodology: method, check, finding: analyze(dataset, method) });
    expect(study.publishState).toBe("draft");
    expect(study.finding).not.toBeNull();
    expect(study.datasetSchema["@type"]).toBe("Dataset");
  });

  it("drops the finding and explains when integrity refuses (unlicensed)", () => {
    const study = composeStudy({
      angle,
      methodology: method,
      check: { verdict: "unlicensed", reason: "no license" },
      finding: analyze(fixtureDataset(), method),
    });
    expect(study.finding).toBeNull();
    expect(study.integrityNote).toMatch(/won't|insufficient|unlicensed/i);
    expect(study.publishState).toBe("draft");
  });
});
