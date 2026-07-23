import { NextResponse } from "next/server";
import { getAuditRunRepository } from "@/lib/repositories/audit-runs";

export const runtime = "nodejs";

export async function GET() {
  const run = await getAuditRunRepository().latest("northstar");
  return NextResponse.json({ run });
}
