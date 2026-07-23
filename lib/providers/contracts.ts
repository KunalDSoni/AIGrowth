import type { AuditIssue, CrawledPageEvidence, GeneratedAsset } from "@/lib/domain/types";

export interface WebsiteCrawler { crawl(url: string, options?: { timeoutMs?: number; maxBytes?: number }): Promise<CrawledPageEvidence> }
export interface AuditProvider { audit(url: string): Promise<AuditIssue[]> }
export interface KeywordProvider { suggest(topic: string, market: string): Promise<Array<{ keyword: string; volume?: number; source: string }>> }
export interface SearchDataProvider { inspect(query: string, market: string): Promise<unknown> }
export interface CompetitorProvider { compare(domain: string, competitors: string[]): Promise<unknown> }
export interface AITextProvider { generate(input: { type: string; context: string; tone: string }): Promise<GeneratedAsset> }
export interface AnalyticsProvider { track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>): void }
export type AnalyticsEvent = "audit_started" | "audit_completed" | "recommendation_viewed" | "fix_generated" | "fix_approved" | "recommendation_completed" | "content_opportunity_opened" | "assistant_question_submitted" | "export_clicked";
export interface RateLimiter { check(key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> }
