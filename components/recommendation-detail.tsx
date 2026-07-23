"use client";
import Link from "next/link";
import { ArrowLeft, Check, CircleCheck, Clock3, Gauge } from "lucide-react";
import type { Recommendation } from "@/lib/domain/types";
import { GenerationWorkspace } from "./generation-workspace";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics/client";
import { evidenceReferences } from "@/lib/data/demo";

const scoreLabels: Array<[keyof Recommendation["scoreComponents"], string]> = [
  ["businessRelevance", "Business relevance"],
  ["conversionPotential", "Conversion potential"],
  ["discoveryOpportunity", "Discovery opportunity"],
  ["severity", "Severity"],
  ["evidenceConfidence", "Evidence confidence"],
  ["effort", "Effort"],
  ["risk", "Risk"],
  ["dependencyReadiness", "Dependency readiness"],
];

export function RecommendationDetail({ item }: { item: Recommendation }) {
  const [done, setDone] = useState(false);
  const evidence = evidenceReferences.filter((reference) => item.evidenceIds.includes(reference.id));

  useEffect(() => {
    setDone(localStorage.getItem(`opengrowth:done:${item.id}`) === "true");
    track("recommendation_viewed", { recommendation: item.id });
  }, [item.id]);

  const complete = () => {
    localStorage.setItem(`opengrowth:done:${item.id}`, "true");
    setDone(true);
    track("recommendation_completed", { recommendation: item.id });
  };

  return <>
    <Link href="/demo/dashboard" className="back-link"><ArrowLeft size={15} /> Back to priorities</Link>
    <div className="detail-head">
      <div>
        <div className="rec-meta"><span className={`severity ${item.severity}`}>{item.severity}</span><span>{item.category}</span><span>Priority score {item.priorityScore}</span></div>
        <h1 className="serif">{item.title}</h1>
        <p>{item.explanation}</p>
      </div>
      <button className={`btn ${done ? "btn-secondary" : "btn-primary"}`} onClick={complete} disabled={done}>{done ? <CircleCheck size={17} /> : <Check size={17} />} {done ? "Completed" : "Mark completed"}</button>
    </div>
    <div className="detail-grid">
      <div className="surface detail-block"><span className="eyebrow">Recommended fix</span><h3>{item.action}</h3><p className="muted">{item.outcome}</p></div>
      <div className="surface detail-facts"><div><Gauge size={18} /><span>Estimated impact</span><b>{item.impact}</b></div><div><Clock3 size={18} /><span>Estimated effort</span><b>{item.effort}</b></div><div><Check size={18} /><span>Confidence</span><b>{item.confidence}</b></div></div>
    </div>
    <section className="surface intelligence-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Why this is prioritized</span><h2>Decision evidence</h2></div>
        <span className="pill">Transparent score</span>
      </div>
      <p className="muted">{item.scoreExplanation}</p>
      <div className="score-grid">
        {scoreLabels.map(([key, label]) => <div key={key} className="score-line"><span>{label}</span><b>{item.scoreComponents[key]}/100</b><div><i style={{ width: `${item.scoreComponents[key]}%` }} /></div></div>)}
      </div>
    </section>
    <section className="surface evidence-panel">
      <div className="panel-heading"><div><span className="eyebrow">Evidence provenance</span><h2>Sources behind the action</h2></div><span className="pill">{evidence.length} references</span></div>
      {evidence.length ? <div className="evidence-list">{evidence.map((reference) => <article key={reference.id} className="evidence-item">
        <div><b>{reference.summary}</b><p className="muted">{reference.source} | {reference.kind.replaceAll("_", " ").toLowerCase()} | reliability {reference.reliability.toLowerCase()}</p></div>
        <div className="evidence-flags"><span>{reference.isSimulated ? "Simulated" : "Observed"}</span><span>{reference.isEstimated ? "Estimated" : "Direct"}</span></div>
      </article>)}</div> : <p className="muted">No evidence references are attached yet.</p>}
    </section>
    <div className="proof-grid">
      <section className="surface proof-block"><span className="eyebrow">Assumptions</span>{item.assumptions.map((value) => <p key={value}>{value}</p>)}</section>
      <section className="surface proof-block"><span className="eyebrow">Dependencies and risk</span><p><b>Risk:</b> {item.risk}</p>{item.dependencies.map((value) => <p key={value}>{value}</p>)}</section>
      <section className="surface proof-block"><span className="eyebrow">Definition of done</span>{item.completionCriteria.map((value) => <p key={value}>{value}</p>)}</section>
    </div>
    <section className="surface measurement-panel">
      <div><span className="eyebrow">Measurement plan</span><h2>How to judge the outcome</h2><p className="muted">{item.measurementPlan.attributionLimits}</p></div>
      <div className="measurement-grid">
        <div><b>Baseline</b><span>{item.measurementPlan.baseline}</span></div>
        <div><b>Implementation</b><span>{item.measurementPlan.implementationEvent}</span></div>
        <div><b>Comparison window</b><span>{item.measurementPlan.comparisonWindow}</span></div>
      </div>
      <div className="measurement-grid">
        <div><b>Leading indicators</b><span>{item.measurementPlan.leadingIndicators.join(", ")}</span></div>
        <div><b>Success signals</b><span>{item.measurementPlan.successSignals.join(", ")}</span></div>
      </div>
    </section>
    <div className="projection surface"><div><span className="eyebrow">Potential outcome</span><h2>What could change</h2><p className="muted">Sample projections based on demo assumptions. They are not guaranteed outcomes.</p></div>{item.metrics.map((m) => <div key={m.label}><b>{m.value}</b><span>{m.label}</span></div>)}</div>
    <GenerationWorkspace item={item} />
  </>;
}
