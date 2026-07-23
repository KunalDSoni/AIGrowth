"use client";
import { useMemo, useState } from "react";
import { FileSearch, X } from "lucide-react";
import type { EvidenceReference } from "@/lib/domain/types";
import { summarizeEvidence, type EvidenceStrength, type Freshness } from "@/lib/engines/evidence";

const STRENGTH_COLOR: Record<EvidenceStrength, string> = {
  strong: "#166534",
  moderate: "#92400e",
  weak: "#9f1239",
};

const FRESHNESS_COLOR: Record<Freshness, string> = {
  fresh: "#166534",
  aging: "#92400e",
  stale: "#9f1239",
  unknown: "#475569",
};

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ color, border: `1px solid ${color}`, borderRadius: 999, padding: "1px 8px", fontSize: 11, textTransform: "capitalize" }}>
      {text}
    </span>
  );
}

/**
 * EVID-002 — an inspectable explanation for a decision. Shows every evidence
 * reference with strength, provenance and freshness so a user can judge how much
 * to trust the recommendation it supports.
 */
export function EvidenceDrawer({ references, affectedAssets }: { references: EvidenceReference[]; affectedAssets?: string[] }) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => summarizeEvidence(references), [references]);

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)} type="button">
        <FileSearch size={16} /> Inspect evidence ({summary.total})
      </button>
      {open && (
        <div className="evidence-drawer-overlay" onClick={() => setOpen(false)} style={overlayStyle}>
          <aside className="surface" onClick={(e) => e.stopPropagation()} style={drawerStyle}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Evidence provenance</span>
                <h2>Why you can trust this</h2>
              </div>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close evidence drawer" type="button">
                <X size={18} />
              </button>
            </div>
            <p className="muted">
              {summary.total} references · {summary.strong} strong · {summary.simulated} simulated · {summary.stale} stale. Simulated and
              estimated evidence is labelled and should be verified before acting.
            </p>
            {affectedAssets && affectedAssets.length > 0 && (
              <p className="muted">
                <b>Affected assets:</b> {affectedAssets.join(", ")}
              </p>
            )}
            <div className="evidence-list">
              {summary.views.map((view) => (
                <article key={view.id} className="evidence-item">
                  <div>
                    <b>{view.summary}</b>
                    <p className="muted">
                      {view.sourceEngine}
                      {view.observedAt ? ` · observed ${view.observedAt.slice(0, 10)}` : ""}
                      {view.ageDays !== null ? ` · ${view.ageDays}d old` : ""}
                    </p>
                  </div>
                  <div className="evidence-flags" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Badge text={view.strength} color={STRENGTH_COLOR[view.strength]} />
                    <Badge text={view.provenance} color="#334155" />
                    <Badge text={view.freshness} color={FRESHNESS_COLOR[view.freshness]} />
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  justifyContent: "flex-end",
  zIndex: 50,
};

const drawerStyle: React.CSSProperties = {
  width: "min(480px, 92vw)",
  height: "100%",
  overflowY: "auto",
  borderRadius: 0,
  padding: 24,
};
