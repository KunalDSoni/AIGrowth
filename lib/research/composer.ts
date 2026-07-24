// lib/research/composer.ts
import type { MethodologyCheck, Methodology, Study, StudyAngle, StudyFinding } from "./types";
import { INTEGRITY_REFUSAL } from "./types";

export function datasetSchema(finding: StudyFinding): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: finding.question,
    measurementTechnique: finding.method,
    variableMeasured: {
      "@type": "PropertyValue",
      name: finding.question,
      value: finding.value,
      unitText: "percent",
      description: `n=${finding.n}, source=${finding.source}, 95% CI ${finding.interval.low}–${finding.interval.high}%`,
    },
  };
}

export function composeStudy(args: {
  angle: StudyAngle;
  methodology: Methodology;
  check: MethodologyCheck;
  finding: StudyFinding | null;
}): Study {
  const refuses = args.check.verdict === "unlicensed" || args.check.verdict === "insufficient";
  const finding = refuses ? null : args.finding;
  const integrityNote = refuses ? `${INTEGRITY_REFUSAL} (${args.check.reason})` : args.check.reason;
  return {
    angleId: args.angle.id,
    methodology: args.methodology,
    check: args.check,
    finding,
    datasetSchema: finding ? datasetSchema(finding) : {},
    publishState: "draft",
    integrityNote,
  };
}
