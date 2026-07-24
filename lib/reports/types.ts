/** Typed, presentation-agnostic report document shared by all three reports. */

export type SectionStatus = "ready" | "not_run" | "insufficient";

export type ReportBlock =
  | { kind: "kpis"; items: { label: string; value: string; hint?: string }[] }
  | { kind: "chapter"; title: string; body: string; bullets: string[] }
  | { kind: "list"; title: string; items: string[] }
  | { kind: "table"; title: string; columns: string[]; rows: string[][] }
  | { kind: "callout"; tone: "info" | "warn"; text: string }
  | { kind: "insufficient"; reason: string };

export interface ReportSection {
  id: string;
  title: string;
  blocks: ReportBlock[];
}

export interface ReportModel {
  slug: "seo" | "geo" | "marketing";
  title: string;
  domain: string;
  brand: string;
  generatedAt: string;
  status: SectionStatus;
  sections: ReportSection[];
}
