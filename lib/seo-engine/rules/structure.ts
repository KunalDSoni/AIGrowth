import { isUtilityPage, pageRule, siteRule } from './define';
import type { Rule } from '../core/types';

export const structureRules: Rule[] = [
  pageRule({
    id: 'h1-missing',
    title: 'Missing <h1>',
    severity: 'critical',
    description: 'The h1 is the strongest on-page signal of what a page is about.',
    check(page, _ctx, emit) {
      if (isUtilityPage(page)) return;
      if (!page.headings.some((h) => h.level === 1)) {
        emit({ message: 'Page has no <h1>', remedy: 'Add a single h1 describing the page topic.' });
      }
    },
  }),

  pageRule({
    id: 'h1-multiple',
    title: 'Multiple <h1> elements',
    severity: 'warning',
    description: 'Competing h1s dilute the page topic signal.',
    check(page, _ctx, emit) {
      const h1s = page.headings.filter((h) => h.level === 1);
      if (h1s.length > 1) {
        emit({
          line: h1s[1]!.line,
          message: `Page has ${h1s.length} <h1> elements`,
          context: h1s.map((h) => h.text.slice(0, 40)).join(' | '),
          remedy: 'Keep one h1 and demote the rest to h2.',
        });
      }
    },
  }),

  pageRule({
    id: 'heading-skip',
    title: 'Heading level skipped',
    severity: 'notice',
    description: 'Jumping h2 to h4 breaks the document outline for crawlers and screen readers.',
    check(page, _ctx, emit) {
      let previous = 0;
      for (const heading of page.headings) {
        if (previous > 0 && heading.level > previous + 1) {
          emit({
            line: heading.line,
            message: `Heading jumps from h${previous} to h${heading.level}`,
            context: heading.text.slice(0, 60),
          });
        }
        previous = heading.level;
      }
    },
  }),

  pageRule({
    id: 'heading-empty',
    title: 'Empty heading element',
    severity: 'notice',
    description: 'Empty headings are usually leftover markup and confuse the outline.',
    check(page, _ctx, emit) {
      for (const heading of page.headings) {
        if (heading.text.trim() === '') {
          emit({ line: heading.line, message: `Empty <h${heading.level}> element` });
        }
      }
    },
  }),

  pageRule({
    id: 'content-thin',
    title: 'Thin content',
    severity: 'warning',
    description: 'Pages with little unique text rarely rank for competitive terms.',
    check(page, ctx, emit) {
      if (isUtilityPage(page)) return;
      const floor = ctx.site.config.thinContentWords ?? 250;
      if (page.wordCount < floor) {
        emit({
          message: `Page has ${page.wordCount} words (below the ${floor}-word threshold)`,
          remedy: 'Expand with substantive, original content or consolidate into another page.',
        });
      }
    },
  }),

  siteRule({
    id: 'content-duplicate',
    title: 'Duplicate content across pages',
    severity: 'warning',
    description: 'Near-identical pages compete with each other and waste crawl budget.',
    check(ctx, emit) {
      const byHash = new Map<string, string[]>();
      for (const page of ctx.pages) {
        if (page.parseError || page.wordCount < 50 || isUtilityPage(page)) continue;
        const list = byHash.get(page.contentHash);
        if (list) list.push(page.relPath);
        else byHash.set(page.contentHash, [page.relPath]);
      }
      for (const paths of byHash.values()) {
        if (paths.length < 2) continue;
        emit({
          relPath: paths[0]!,
          message: `${paths.length} pages have identical body content`,
          context: paths.slice(0, 6).join(', '),
          remedy: 'Consolidate them, or differentiate the content and canonicalise.',
        });
      }
    },
  }),
];
