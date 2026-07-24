"use client";

import { PageHeader } from "@/components/page-header";

/**
 * MLE-7 — Machine Legibility surface.
 *
 * The engine diffs what machines believe about the brand against verified truth.
 * Both inputs — the account's verified facts (each needs a named human verifier)
 * and the belief signals gathered from the machines — are supplied to
 * POST /api/legibility. This surface documents the pipeline honestly rather than
 * fabricating belief data the app has not actually gathered.
 */
export default function LegibilityPage() {
  const stages: { title: string; body: string }[] = [
    {
      title: "Ground truth",
      body: "Your human-verified facts (category, offerings, price, service areas, differentiators), each with a named verifier and a source. Facts without a source can guide internal work but can never back a public correction.",
    },
    {
      title: "Entity graph",
      body: "What the machines currently believe about you, assembled from answer-engine probes, knowledge panels, Wikidata, on-site schema, review sites, and Reddit — with contested beliefs surfaced, not hidden.",
    },
    {
      title: "Gap finder",
      body: "The diff: where machines are wrong (mismatch), silent (missing), or asserting the unverifiable (unconfirmed) — ranked by commercial impact, and marked correctable only when a source backs the fix.",
    },
    {
      title: "Two lenses",
      body: "Answer-engine: route each correction to where it lands (schema, Wikidata/Wikipedia, reviews, Reddit, or a Frontier-3 study). Shopping-agent: score whether your product is machine-buyable and detect missing feed fields.",
    },
    {
      title: "Legibility score + human-gated playbook",
      body: "One score across both lenses with honest before/after movement (no claims on thin data). Corrections are drafted true-and-sourced only, flag third-party control, and never submit without a named approver.",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Machine legibility"
        description="From measurement to control: score and fix how every machine — answer engines and shopping agents — perceives your brand, off one shared entity core. True, sourced corrections only."
      />
      <p className="text-sm text-muted-foreground">
        This engine runs on two inputs it does not invent: your verified facts and the belief
        signals gathered from the machines. Provide them to{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">POST /api/legibility</code> to compute
        the belief-vs-truth diff, both lenses, the legibility score, and a human-gated correction
        playbook.
      </p>
      <ol className="space-y-3">
        {stages.map((s, i) => (
          <li key={s.title} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-primary">{i + 1}</span>
              <h3 className="text-sm font-medium text-foreground">{s.title}</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
