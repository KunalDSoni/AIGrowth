import { allRules } from '../rules/index';
import type { Finding, Severity, SiteContext } from './types';

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 10,
  warning: 3,
  notice: 1,
};

export interface SiteAudit {
  siteId: string;
  siteName: string;
  root: string;
  pageCount: number;
  findings: Finding[];
  counts: Record<Severity, number>;
  /** 0-100, weighted by severity and normalised by page count. */
  score: number;
}

/**
 * Score decays asymptotically rather than subtracting linearly. A linear penalty
 * bottoms out at zero almost immediately on a real site, which makes every site look
 * equally broken and destroys the ranking — the whole point of the number.
 *
 * The curve is anchored so that a site averaging one critical issue per page (weight
 * 10) scores 50. Zero issues is 100; nothing ever quite reaches 0, so heavily broken
 * sites stay comparable to each other.
 */
const SCORE_HALF_LIFE = 10;

function computeScore(findings: Finding[], pageCount: number): number {
  if (pageCount === 0) return 100;
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  const perPage = penalty / pageCount;
  return Math.round(100 / (1 + perPage / SCORE_HALF_LIFE));
}

export function auditSite(ctx: SiteContext): SiteAudit {
  const disabled = new Set(ctx.site.config.disabledRules ?? []);
  const overrides = ctx.site.config.severityOverrides ?? {};
  const findings: Finding[] = [];

  for (const rule of allRules) {
    if (disabled.has(rule.id)) continue;
    try {
      if (rule.scope === 'site') {
        findings.push(...rule.check(null, ctx));
      } else {
        for (const page of ctx.pages) {
          findings.push(...rule.check(page, ctx));
        }
      }
    } catch (err) {
      // A rule that throws must not abort the audit; report it as a finding instead.
      findings.push({
        ruleId: 'engine-rule-error',
        severity: 'notice',
        siteId: ctx.site.id,
        relPath: null,
        line: null,
        message: `Rule "${rule.id}" threw: ${(err as Error).message}`,
      });
    }
  }

  for (const finding of findings) {
    const override = overrides[finding.ruleId];
    if (override) finding.severity = override;
  }

  const counts: Record<Severity, number> = { critical: 0, warning: 0, notice: 0 };
  for (const finding of findings) counts[finding.severity]++;

  return {
    siteId: ctx.site.id,
    siteName: ctx.site.name,
    root: ctx.site.root,
    pageCount: ctx.pages.length,
    findings,
    counts,
    score: computeScore(findings, ctx.pages.length),
  };
}
