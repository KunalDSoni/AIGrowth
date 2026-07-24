// lib/research/engine.ts
import type { Methodology, Study, StudyAngle, StudyFinding } from "./types";
import type { DatasetProvider } from "./sourcer";
import { checkSupport } from "./methodology";
import { analyze } from "./analysis";
import { composeStudy } from "./composer";

export async function runStudy(args: {
  angle: StudyAngle;
  methodology: Methodology;
  provider: DatasetProvider;
}): Promise<Study> {
  const dataset = await args.provider.fetch(args.angle.id);
  const check = checkSupport(dataset, args.methodology);
  const canAnalyze = check.verdict === "supported" || check.verdict === "directional";
  const finding: StudyFinding | null = canAnalyze ? analyze(dataset, args.methodology) : null;
  return composeStudy({ angle: args.angle, methodology: args.methodology, check, finding });
}
