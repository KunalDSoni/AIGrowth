import type { ReportBlock, ReportModel, ReportSection } from "@/lib/reports/types";

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderBlock(block: ReportBlock): string {
  switch (block.kind) {
    case "kpis":
      return `<div class="kpis">${block.items
        .map(
          (i) =>
            `<div class="kpi"><span class="kpi-label">${esc(i.label)}</span><strong>${esc(i.value)}</strong>${
              i.hint ? `<span class="kpi-hint">${esc(i.hint)}</span>` : ""
            }</div>`,
        )
        .join("")}</div>`;
    case "chapter":
      return `<div class="chapter"><h3>${esc(block.title)}</h3><p>${esc(block.body)}</p><ul>${block.bullets
        .map((b) => `<li>${esc(b)}</li>`)
        .join("")}</ul></div>`;
    case "list":
      return `<div class="chapter"><h3>${esc(block.title)}</h3><ul>${block.items
        .map((i) => `<li>${esc(i)}</li>`)
        .join("")}</ul></div>`;
    case "table":
      return `<div class="chapter"><h3>${esc(block.title)}</h3><table><thead><tr>${block.columns
        .map((c) => `<th>${esc(c)}</th>`)
        .join("")}</tr></thead><tbody>${block.rows
        .map((r) => `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></div>`;
    case "callout":
      return `<div class="callout ${block.tone}">${esc(block.text)}</div>`;
    case "insufficient":
      return `<div class="insufficient"><strong>Insufficient evidence.</strong> ${esc(block.reason)}</div>`;
  }
}

function renderSection(section: ReportSection): string {
  return `<section><h2>${esc(section.title)}</h2>${section.blocks.map(renderBlock).join("")}</section>`;
}

function renderModelBody(model: ReportModel, pageBreak: boolean): string {
  return `<article class="report${pageBreak ? " page-break-before" : ""}">
    <header class="report-head">
      <div class="eyebrow">${esc(model.brand)} · ${esc(model.domain)}</div>
      <h1>${esc(model.title)}</h1>
      <div class="meta">Generated ${esc(model.generatedAt)} · status: ${esc(model.status)}</div>
    </header>
    ${model.sections.map(renderSection).join("")}
  </article>`;
}

const STYLES = `
:root { color-scheme: light; --ink:#0f172a; --muted:#475569; --line:#e2e8f0; --accent:#0f766e; --warn:#b45309; }
@page { size: A4; margin: 20mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "Inter", "Helvetica Neue", Arial, sans-serif; margin: 0; color: var(--ink); background: #fff; }
.cover { display:flex; flex-direction:column; justify-content:center; min-height: 90vh; padding: 0 8mm; page-break-after: always; }
.cover .brand { font-size: 13px; letter-spacing: .16em; text-transform: uppercase; color: var(--accent); }
.cover h1 { font-size: 40px; letter-spacing: -0.02em; margin: 12px 0; }
.cover .meta { color: var(--muted); font-size: 14px; }
.report { padding: 0 8mm 8mm; }
.page-break-before { page-break-before: always; }
.report-head { border-bottom: 2px solid var(--accent); padding-bottom: 12px; margin-bottom: 20px; }
.eyebrow { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); }
h1 { font-size: 28px; margin: 6px 0; letter-spacing: -0.01em; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); margin: 28px 0 12px; }
h3 { font-size: 16px; margin: 18px 0 8px; }
p, li, td, th { font-size: 13.5px; line-height: 1.5; color: var(--muted); }
.meta { font-size: 12px; color: var(--muted); }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 8px 0 4px; }
.kpi { border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
.kpi-label { display:block; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.kpi strong { display:block; font-size: 24px; color: var(--ink); margin-top: 4px; }
.kpi-hint { display:block; font-size: 11px; color: #94a3b8; margin-top: 2px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th { text-align: left; border-bottom: 1px solid var(--line); padding: 6px 8px; color: var(--ink); }
td { border-bottom: 1px solid var(--line); padding: 6px 8px; vertical-align: top; }
.callout { border-radius: 8px; padding: 10px 12px; margin: 10px 0; font-size: 13px; }
.callout.info { background: #ecfeff; color: #0e7490; }
.callout.warn { background: #fffbeb; color: var(--warn); }
.insufficient { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 12px; margin: 10px 0; color: var(--muted); font-size: 13px; }
`;

export function renderReportHtml(input: ReportModel | ReportModel[]): string {
  const models = Array.isArray(input) ? input : [input];
  const first = models[0];
  const bundle = models.length > 1;
  const title = bundle ? "Full Position Report" : first.title;

  const cover = `<div class="cover">
    <div class="brand">${esc(first.brand)} · ${esc(first.domain)}</div>
    <h1>${esc(title)}</h1>
    <div class="meta">Generated ${esc(first.generatedAt)}</div>
  </div>`;

  const body = models.map((m, idx) => renderModelBody(m, bundle && idx > 0)).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} — ${esc(first.domain)}</title>
  <style>${STYLES}</style>
</head>
<body>
  ${cover}
  ${body}
</body>
</html>`;
}
