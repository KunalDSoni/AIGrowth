"use client";
import { useMemo, useState } from "react";
import { Check, PencilLine, X } from "lucide-react";
import {
  applyConfirmation,
  pendingReview,
  rankedEntities,
  type BusinessEntityType,
  type BusinessGraph,
} from "@/lib/engines/business-graph";
import { businessGraph as seedGraph } from "@/lib/data/demo";

const TYPES: [BusinessEntityType, string][] = [
  ["service", "Services"],
  ["audience", "Audiences"],
  ["geography", "Geographies"],
  ["differentiator", "Differentiators"],
  ["competitor", "Competitors"],
];

const statusColor: Record<string, string> = {
  confirmed: "#166534",
  "user-supplied": "#1d4ed8",
  observed: "#0f766e",
  "ai-inferred": "#b45309",
  rejected: "#9f1239",
};

export default function BusinessGraphPage() {
  const [graph, setGraph] = useState<BusinessGraph>(seedGraph);
  const [log, setLog] = useState<string[]>([]);

  const pending = useMemo(() => pendingReview(graph), [graph]);

  const decide = (entityId: string, action: "confirm" | "reject" | "edit", label?: string) => {
    const result = applyConfirmation(graph, {
      entityId,
      action,
      label,
      at: new Date().toISOString().slice(0, 19).replace("T", " "),
    });
    setGraph(result.graph);
    setLog((prev) => [result.audit, ...prev].slice(0, 8));
  };

  const edit = (entityId: string, current: string) => {
    const next = typeof window !== "undefined" ? window.prompt("Edit and confirm this fact:", current) : null;
    if (next && next.trim()) decide(entityId, "edit", next.trim());
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Business understanding</span>
          <h1 className="serif">Confirm what we believe about your business</h1>
          <p>AI-inferred facts must be reviewed before they influence recommendations. Confirmed facts outrank inferred ones in every score.</p>
        </div>
        <span className="pill">{pending.length} awaiting review</span>
      </div>

      <div className="context-note">
        <div>
          <b>Why this matters</b>
          <p>Nothing the AI guesses about your business is treated as truth until you confirm it. Reject anything wrong and it stops affecting scoring immediately.</p>
        </div>
      </div>

      <section className="surface citation-actions">
        <span className="eyebrow">Review queue</span>
        <h2>Inferred facts to confirm, edit or reject</h2>
        {pending.length === 0 ? (
          <p className="muted">Nothing left to review — every inferred fact has a decision.</p>
        ) : (
          <div className="citation-action-grid">
            {pending.map((entity) => (
              <article key={entity.id}>
                <span className="pill" style={{ color: statusColor[entity.status] }}>{entity.type} · inferred</span>
                <h3>{entity.label}</h3>
                <p className="fine">Confidence {entity.confidence}%</p>
                <div className="tag-row">
                  <button className="btn btn-primary" type="button" onClick={() => decide(entity.id, "confirm")}><Check size={14} /> Confirm</button>
                  <button className="btn btn-secondary" type="button" onClick={() => edit(entity.id, entity.label)}><PencilLine size={14} /> Edit</button>
                  <button className="btn btn-secondary" type="button" onClick={() => decide(entity.id, "reject")}><X size={14} /> Reject</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="surface citation-actions">
        <span className="eyebrow">Knowledge graph</span>
        <h2>What we know, ranked by trust</h2>
        <div className="ai-columns">
          {TYPES.map(([type, label]) => {
            const entities = rankedEntities(graph, type);
            if (entities.length === 0) return null;
            return (
              <div key={type}>
                <h3>{label}</h3>
                {entities.map((entity) => (
                  <p className="fine" key={entity.id}>
                    <span style={{ color: statusColor[entity.status] }}>&#9679;</span> {entity.label}
                    <span className="muted"> — {entity.status}</span>
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {log.length > 0 && (
        <section className="surface citation-actions">
          <span className="eyebrow">Audit trail</span>
          <h2>Recent decisions</h2>
          {log.map((entry, index) => <p className="fine" key={index}>{entry}</p>)}
        </section>
      )}
    </>
  );
}
