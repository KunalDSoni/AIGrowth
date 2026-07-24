"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { measureLift, shipFix } from "@/lib/client/geo-fix-actions";
import type { CitationFix } from "@/lib/engines/geo-citation-fix";

/**
 * GIL-UI-2 — Human-gated ship + measure for a single fix.
 *
 * Approving requires a name (the never-anonymous gate, enforced here and again
 * server-side). After shipping, the same card measures the citation lift.
 */
export function FixShipControls({ domain, fix }: { domain: string; fix: CitationFix }) {
  const [approver, setApprover] = useState("");
  const [interventionId, setInterventionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liftText, setLiftText] = useState<string | null>(null);

  async function onShip() {
    setBusy(true);
    setError(null);
    try {
      const { intervention } = await shipFix(domain, fix, approver);
      setInterventionId(intervention.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function onMeasure() {
    if (!interventionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await measureLift(domain, interventionId);
      if (res.measured && res.lift) {
        const l = res.lift;
        setLiftText(
          `${l.label} — ${l.deltaShare > 0 ? "+" : ""}${Math.round(l.deltaShare * 100)} pts ` +
            `(${Math.round(l.baseline.citedShare * 100)}% → ${Math.round(l.post.citedShare * 100)}%)`,
        );
      } else {
        setLiftText(res.note ?? "No measurement available.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t pt-3">
      {!interventionId ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Approver name"
            placeholder="Your name (approver)"
            value={approver}
            onChange={(e) => setApprover(e.target.value)}
            className="h-8 max-w-52"
          />
          <Button size="sm" disabled={busy || !approver.trim()} onClick={onShip}>
            {busy ? "Shipping…" : "Approve & ship"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-emerald-600">Shipped ✓</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={onMeasure}>
            {busy ? "Measuring…" : "Measure lift"}
          </Button>
          {liftText && <span className="text-muted-foreground">{liftText}</span>}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
