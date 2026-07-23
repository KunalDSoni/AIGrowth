import { NextResponse } from "next/server";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { loadBusinessOverrides } from "@/lib/projects/business-profile";
import { runAllEpics } from "@/lib/epics/run-all-epics";
import { ALL_EPIC_IDS } from "@/lib/epics/registry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  const epicId = url.searchParams.get("epicId");

  if (!domain) {
    return NextResponse.json({
      total: ALL_EPIC_IDS.length,
      epicIds: ALL_EPIC_IDS,
      note: "Pass ?domain=example.com to run the full suite against a live analyze.",
    });
  }

  const key = domainKey(domain);
  const store = getProjectStore();
  const latest = await store.loadLatest(key);
  if (!latest) return NextResponse.json({ error: "Analyze first" }, { status: 404 });

  const overrides = await loadBusinessOverrides(key);
  const bundle = await store.loadBundle(key);
  const suite = runAllEpics({
    result: latest,
    overrides: overrides ?? undefined,
    history: bundle?.history ?? [],
    delta: await store.loadDelta(key),
    intelligence: latest.intelligence,
  });

  if (epicId) {
    const one = suite.byId[epicId as keyof typeof suite.byId];
    if (!one) return NextResponse.json({ error: "Unknown epicId" }, { status: 404 });
    return NextResponse.json(one);
  }

  return NextResponse.json({
    complete: suite.complete,
    completedCount: suite.completedCount,
    totalCount: suite.totalCount,
    epics: suite.epics.map((e) => ({ epicId: e.epicId, status: e.status, summary: e.summary })),
    // Full payloads available per epic via ?epicId=
  });
}
