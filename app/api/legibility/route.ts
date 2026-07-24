import { NextResponse } from "next/server";
import { buildLegibilityReport } from "@/lib/engines/legibility-engine";
import type { BeliefSignal } from "@/lib/engines/legibility-entity-graph";
import { createRegistry, upsertFact, verifyFact } from "@/lib/engines/legibility-ground-truth";
import type { GroundTruthRegistry } from "@/lib/engines/legibility-ground-truth";
import type { ProductFeedItem } from "@/lib/engines/legibility-shopping-agent-lens";

export const runtime = "nodejs";

/**
 * MLE-7 — Machine Legibility report.
 *
 * Computes the belief-vs-truth diff, both lenses, the legibility score, and a
 * human-gated correction playbook from posted inputs: the account's verified
 * facts and the belief signals gathered from the machines. No store and no
 * fabrication — the caller supplies the truth (each fact requires a named
 * verifier) and the observed beliefs; the engine only diffs and scores them.
 */
export async function POST(request: Request) {
  let body: {
    subject?: string;
    signals?: BeliefSignal[];
    facts?: {
      id: string;
      attribute: string;
      value: string;
      category: Parameters<typeof verifyFact>[0]["category"];
      verifiedBy: string;
      sourceUrl?: string;
      sourceNote?: string;
    }[];
    supportingFacts?: { attribute: string; sourceStudyId: string }[];
    product?: ProductFeedItem;
    hasStructuredEndpoint?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", report: null }, { status: 400 });
  }

  const subject = (body.subject ?? "").trim();
  if (!subject) {
    return NextResponse.json({ error: "A subject is required.", report: null }, { status: 400 });
  }

  try {
    let groundTruth: GroundTruthRegistry = createRegistry(subject);
    for (const f of body.facts ?? []) {
      // verifyFact enforces the named-verifier and non-empty-value integrity gates.
      groundTruth = upsertFact(groundTruth, verifyFact({ subject, ...f }));
    }

    const report = buildLegibilityReport({
      subject,
      signals: body.signals ?? [],
      groundTruth,
      supportingFacts: body.supportingFacts,
      product: body.product,
      hasStructuredEndpoint: body.hasStructuredEndpoint,
    });

    return NextResponse.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build legibility report";
    return NextResponse.json({ error: message, report: null }, { status: 400 });
  }
}
