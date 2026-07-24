import { NextResponse } from "next/server";
import { domainKey } from "@/lib/projects/store";
import { loadLifts } from "@/lib/engines/geo-fix-store";
import { buildLiftReport } from "@/lib/engines/geo-lift-report";

export const runtime = "nodejs";

/**
 * OPS-4 — Measured citation-lift report for a domain.
 *
 * Reads the persisted lifts (OPS-1) and summarizes them (GIL-12). An empty set
 * is a valid state — the report headline says so honestly rather than 404ing.
 */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "A domain is required.", report: null }, { status: 400 });
  }
  const report = buildLiftReport(loadLifts(domainKey(domain)));
  return NextResponse.json({ report });
}
