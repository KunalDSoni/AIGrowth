import fs from 'node:fs';
import path from 'node:path';
import { isUtilityPage, pageRule, siteRule } from './define';
import type { Rule } from '../core/types';

/**
 * AI-search readiness.
 *
 * LLM crawlers differ from Googlebot in two ways that matter here: most do not
 * execute JavaScript, and they extract discrete claims rather than ranking whole
 * pages. So the checks are about *extractability* — is the substance present in the
 * served HTML, and is it shaped so a machine can lift an answer out of it.
 */

const QUESTION_PATTERN = /\b(what|how|why|when|where|which|who|can|does|is|are|should)\b.*\?/i;

export const aiRules: Rule[] = [
  siteRule({
    id: 'llms-txt-missing',
    title: 'No llms.txt',
    severity: 'notice',
    fixable: true,
    description:
      'llms.txt is the emerging convention for telling AI crawlers what a site is ' +
      'about and which pages matter. Cheap to add, and Lighthouse now audits for it.',
    check(ctx, emit) {
      const candidate = path.join(ctx.site.root, 'llms.txt');
      if (!fs.existsSync(candidate)) {
        emit({
          message: 'Site has no llms.txt',
          remedy: 'Add an llms.txt at the site root summarising the site and its key pages.',
        });
      }
    },
  }),

  pageRule({
    id: 'ai-content-js-only',
    title: 'Page has almost no server-rendered content',
    severity: 'critical',
    description:
      'Most AI crawlers do not execute JavaScript. A page whose text only appears ' +
      'after hydration is invisible to them regardless of how it looks in a browser.',
    check(page, _ctx, emit) {
      if (isUtilityPage(page)) return;
      // A large file with almost no extractable text is the signature of a shell
      // page whose content is injected client-side.
      if (page.bytes > 12000 && page.wordCount < 80) {
        emit({
          message: `Page is ${Math.round(page.bytes / 1024)}KB but contains only ${page.wordCount} words of server-rendered text`,
          remedy: 'Server-render or pre-render the main content so non-JS crawlers can read it.',
        });
      }
    },
  }),

  pageRule({
    id: 'ai-no-answerable-structure',
    title: 'Long page with no question-shaped headings',
    severity: 'notice',
    description:
      'LLMs preferentially cite content that directly answers a question. Headings ' +
      'phrased as questions, or an FAQ block, make a page far more citable.',
    check(page, _ctx, emit) {
      if (isUtilityPage(page) || page.wordCount < 500) return;

      const hasQuestionHeading = page.headings.some((h) => QUESTION_PATTERN.test(h.text));
      const hasFaqSchema = page.jsonLd.some((b) =>
        typeof b.raw === 'string' ? /FAQPage|Question/.test(b.raw) : false,
      );
      if (!hasQuestionHeading && !hasFaqSchema) {
        emit({
          message: `${page.wordCount}-word page has no question-shaped headings or FAQ schema`,
          remedy: 'Add an FAQ section or phrase some subheadings as the questions readers ask.',
        });
      }
    },
  }),

  pageRule({
    id: 'ai-no-entity-schema',
    title: 'Page declares no entity for AI systems to attach facts to',
    severity: 'notice',
    description:
      'Without an Organization, Person, Product or Service node, an AI system has no ' +
      'stable entity to associate the page content with.',
    check(page, _ctx, emit) {
      if (isUtilityPage(page) || page.wordCount < 300) return;
      const raw = page.jsonLd.map((b) => b.raw).join(' ');
      const hasEntity = /"@type"\s*:\s*"?(Organization|Corporation|Person|Product|Service|LocalBusiness|FinancialService)/.test(
        raw,
      );
      if (!hasEntity) {
        emit({ message: 'Page declares no Organization/Person/Product/Service entity' });
      }
    },
  }),

  pageRule({
    id: 'ai-thin-intro',
    title: 'Page does not state what it is about up front',
    severity: 'notice',
    description:
      'Extraction systems weight the opening heavily. A page that opens with navigation ' +
      'or a slogan rather than a definition is harder to summarise correctly.',
    check(page, _ctx, emit) {
      if (isUtilityPage(page) || page.wordCount < 400) return;
      const h1 = page.headings.find((h) => h.level === 1);
      // A very short h1 with no meta description leaves nothing to anchor a summary on.
      if (h1 && h1.text.split(/\s+/).length <= 2 && !page.metaDescription) {
        emit({
          message: `h1 is only "${h1.text}" and there is no meta description to clarify the topic`,
          remedy: 'Add a descriptive meta description, or a fuller opening sentence.',
        });
      }
    },
  }),
];
