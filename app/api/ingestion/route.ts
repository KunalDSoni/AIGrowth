import { NextResponse } from "next/server";
import { buildIngestionReport } from "@/lib/engines/ingestion-report";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * OSI + MDM — open-source ingestion & data-mesh report for a domain.
 *
 * Composes the crawl/audit/GEO/perf/SERP/authority adapters into one report.
 * Defaults are the zero-dependency mocks, so this responds offline with honestly
 * labelled simulated/estimate data; connect real engines via .env to measure.
 */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "A domain is required.", report: null }, { status: 400 });
  }
  try {
    const report = await buildIngestionReport(domain);
    return NextResponse.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build ingestion report";
    return NextResponse.json({ error: message, report: null }, { status: 500 });
  }
}
