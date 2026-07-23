import { NextResponse } from "next/server";
import { getAuditRunRepository } from "@/lib/repositories/audit-runs";
import { domainKey } from "@/lib/projects/store";

export const runtime = "nodejs";

/** Latest audit run for a domain. Previously hardcoded the "northstar" project. */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "A domain is required.", run: null }, { status: 400 });
  }
  const run = await getAuditRunRepository().latest(domainKey(domain));
  return NextResponse.json({ run: run ?? null });
}
