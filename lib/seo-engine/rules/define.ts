import type { Finding, PageFacts, Rule, Severity, SiteContext } from '../core/types';

/**
 * Helpers for writing rules. A rule is a pure function over PageFacts + SiteContext,
 * so it can be tested with a plain object literal and never touches disk or network.
 */

interface PageRuleSpec {
  id: string;
  title: string;
  severity: Severity;
  fixable?: boolean;
  description: string;
  check(page: PageFacts, ctx: SiteContext, emit: Emit): void;
}

interface SiteRuleSpec {
  id: string;
  title: string;
  severity: Severity;
  fixable?: boolean;
  description: string;
  check(ctx: SiteContext, emit: Emit): void;
}

export type Emit = (finding: {
  relPath?: string | null;
  line?: number | null;
  message: string;
  context?: string;
  remedy?: string;
  severity?: Severity;
}) => void;

function makeEmitter(
  ruleId: string,
  defaultSeverity: Severity,
  siteId: string,
  defaultRelPath: string | null,
  sink: Finding[],
): Emit {
  return (f) =>
    sink.push({
      ruleId,
      severity: f.severity ?? defaultSeverity,
      siteId,
      relPath: f.relPath === undefined ? defaultRelPath : f.relPath,
      line: f.line ?? null,
      message: f.message,
      ...(f.context !== undefined ? { context: f.context } : {}),
      ...(f.remedy !== undefined ? { remedy: f.remedy } : {}),
    });
}

export function pageRule(spec: PageRuleSpec): Rule {
  return {
    id: spec.id,
    title: spec.title,
    severity: spec.severity,
    scope: 'page',
    fixable: spec.fixable ?? false,
    description: spec.description,
    check(input, ctx) {
      const page = input as PageFacts;
      if (!page || page.parseError) return [];
      const findings: Finding[] = [];
      spec.check(page, ctx, makeEmitter(spec.id, spec.severity, page.siteId, page.relPath, findings));
      return findings;
    },
  };
}

export function siteRule(spec: SiteRuleSpec): Rule {
  return {
    id: spec.id,
    title: spec.title,
    severity: spec.severity,
    scope: 'site',
    fixable: spec.fixable ?? false,
    description: spec.description,
    check(_input, ctx) {
      const findings: Finding[] = [];
      spec.check(ctx, makeEmitter(spec.id, spec.severity, ctx.site.id, null, findings));
      return findings;
    },
  };
}

/** True when a page asks search engines not to index it — most rules should skip these. */
export function isNoindex(page: PageFacts): boolean {
  return /\bnoindex\b/.test(page.robots ?? '');
}

/** 404 pages and the like are real pages but exempt from most content expectations. */
export function isUtilityPage(page: PageFacts): boolean {
  return /(^|\/)(404|500|offline|thank-you|thanks)(\.html|\/index\.html)$/i.test(page.relPath);
}
