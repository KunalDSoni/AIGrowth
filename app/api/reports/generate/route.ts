import { NextResponse } from "next/server";
import { assembleSpine, type AnalysisSpine } from "@/lib/reports/spine";
import { buildSeoReport } from "@/lib/reports/builders/seo";
import { buildGeoReport } from "@/lib/reports/builders/geo";
import { buildMarketingReport } from "@/lib/reports/builders/marketing";
import { generateReportDocument } from "@/lib/reports/generate";
import type { ReportModel } from "@/lib/reports/types";

export const runtime = "nodejs";

export type ReportSectionId = "seo" | "geo" | "marketing" | "full";

const VALID: ReportSectionId[] = ["seo", "geo", "marketing", "full"];

export function buildModelsForSection(spine: AnalysisSpine, section: ReportSectionId): ReportModel[] {
  switch (section) {
    case "seo":
      return [buildSeoReport(spine)];
    case "geo":
      return [buildGeoReport(spine)];
    case "marketing":
      return [buildMarketingReport(spine)];
    case "full":
      return [buildSeoReport(spine), buildGeoReport(spine), buildMarketingReport(spine)];
    default:
      throw new Error(`Unknown report section: ${section}`);
  }
}

export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "A domain is required." }, { status: 400 });
  }
  const spine = await assembleSpine(domain);
  return NextResponse.json({
    statuses: { seo: spine.seo.status, geo: spine.geo.status, marketing: spine.marketing.status },
  });
}

export async function POST(request: Request) {
  let body: { domain?: string; section?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const domain = body.domain?.trim();
  const section = body.section as ReportSectionId | undefined;
  if (!domain) {
    return NextResponse.json({ error: "A domain is required." }, { status: 400 });
  }
  if (!section || !VALID.includes(section)) {
    return NextResponse.json({ error: `section must be one of ${VALID.join(", ")}.` }, { status: 400 });
  }

  const spine = await assembleSpine(domain);
  const models = buildModelsForSection(spine, section);
  const out = await generateReportDocument(models);
  return NextResponse.json({ url: out.url, format: out.format, section });
}
