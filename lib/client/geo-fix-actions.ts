/**
 * GIL-UI-1 — Client action helpers for driving the loop from the browser.
 *
 * Thin, typed wrappers over the OPS-2 (ship) and OPS-3 (measure) routes. The
 * never-anonymous approval gate is enforced client-side too, before any network
 * call, so the UI cannot even attempt an unattributed ship.
 */

import type { CitationFix } from "@/lib/engines/geo-citation-fix";
import type { InterventionRecord } from "@/lib/engines/geo-intervention";
import type { CitationLift } from "@/lib/engines/geo-lift";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request to ${url} failed (${res.status})`);
  return data;
}

export async function shipFix(
  domain: string,
  fix: CitationFix,
  approvedBy: string,
): Promise<{ intervention: InterventionRecord }> {
  if (!approvedBy.trim()) {
    throw new Error("An approver name is required — fixes are never shipped anonymously.");
  }
  return postJson("/api/geo-fixes/ship", { domain, fix, approvedBy });
}

export async function measureLift(
  domain: string,
  interventionId: string,
): Promise<{ measured: boolean; lift?: CitationLift; note?: string }> {
  return postJson("/api/geo-fixes/measure", { domain, interventionId });
}
