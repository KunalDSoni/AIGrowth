import { auditIssues, generatedAssets } from "@/lib/data/demo";
import type { AITextProvider, AnalyticsProvider, AuditProvider, CompetitorProvider, KeywordProvider } from "./contracts";

export class MockAuditProvider implements AuditProvider { async audit(url: string) { void url; return structuredClone(auditIssues); } }
export class MockKeywordProvider implements KeywordProvider { async suggest(topic: string) { return [{ keyword: `${topic} australia`, source: "simulated" }, { keyword: `${topic} services`, source: "simulated" }]; } }
export class MockCompetitorProvider implements CompetitorProvider { async compare(domain: string, competitors: string[]) { return { domain, competitors, source: "simulated" }; } }
export class MockAITextProvider implements AITextProvider { async generate(input: { type: string; context: string; tone: string }) { return generatedAssets[input.context] ?? { title: input.type, original: "No current version available.", suggested: `A focused ${input.type.toLowerCase()} prepared for Northstar Accounting.`, explanation: "Prepared from the demo project context.", rationale: "Supports the selected recommendation without relying on unverified claims.", tone: input.tone, keyword: "accounting services Australia" }; } }
export class MockAnalyticsProvider implements AnalyticsProvider { track(event: string, properties?: Record<string, unknown>) { if (process.env.NODE_ENV === "development") console.info("[demo analytics]", event, properties ?? {}); } }
