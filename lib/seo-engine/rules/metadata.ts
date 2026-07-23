import { isNoindex, isUtilityPage, pageRule, siteRule } from './define';
import type { Rule } from '../core/types';

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 160;

export const metadataRules: Rule[] = [
  pageRule({
    id: 'title-missing',
    title: 'Missing or empty <title>',
    severity: 'critical',
    fixable: false,
    description: 'Every indexable page needs a unique, descriptive title tag.',
    check(page, _ctx, emit) {
      if (!page.title || page.title.length === 0) {
        emit({
          line: page.titleLine,
          message: 'Page has no title tag',
          remedy: 'Add a <title> of 30-60 characters describing this page.',
        });
      }
    },
  }),

  pageRule({
    id: 'title-length',
    title: 'Title length outside 30-60 characters',
    severity: 'warning',
    description: 'Titles under 30 chars waste SERP space; over 60 get truncated.',
    check(page, _ctx, emit) {
      const title = page.title;
      if (!title) return;
      if (title.length < TITLE_MIN) {
        emit({
          line: page.titleLine,
          message: `Title is ${title.length} characters (under ${TITLE_MIN})`,
          context: title,
          remedy: 'Expand the title to describe the page and include the brand.',
        });
      } else if (title.length > TITLE_MAX) {
        emit({
          line: page.titleLine,
          message: `Title is ${title.length} characters (over ${TITLE_MAX}, will be truncated)`,
          context: title,
          remedy: 'Shorten to under 60 characters, front-loading the important words.',
        });
      }
    },
  }),

  siteRule({
    id: 'title-duplicate',
    title: 'Duplicate <title> across pages',
    severity: 'warning',
    description: 'Two pages sharing a title compete with each other in search results.',
    check(ctx, emit) {
      const byTitle = new Map<string, string[]>();
      for (const page of ctx.pages) {
        if (!page.title || isNoindex(page) || isUtilityPage(page)) continue;
        const key = page.title.toLowerCase();
        (byTitle.get(key) ?? byTitle.set(key, []).get(key)!).push(page.relPath);
      }
      for (const [title, paths] of byTitle) {
        if (paths.length < 2) continue;
        emit({
          relPath: paths[0]!,
          message: `${paths.length} pages share the title "${title}"`,
          context: paths.slice(0, 6).join(', '),
          remedy: 'Give each page a title reflecting its own topic.',
        });
      }
    },
  }),

  pageRule({
    id: 'meta-description-missing',
    title: 'Missing meta description',
    severity: 'critical',
    fixable: false,
    description: 'The meta description drives click-through from the results page.',
    check(page, _ctx, emit) {
      if (isNoindex(page)) return;
      if (page.metaDescription === null || page.metaDescription.trim() === '') {
        emit({
          message: 'Page has no meta description',
          remedy: 'Add a 70-160 character description summarising the page.',
        });
      }
    },
  }),

  pageRule({
    id: 'meta-description-length',
    title: 'Meta description outside 70-160 characters',
    severity: 'warning',
    description: 'Short descriptions under-sell the page; long ones get cut off.',
    check(page, _ctx, emit) {
      const desc = page.metaDescription;
      if (!desc || desc.trim() === '') return;
      if (desc.length < DESC_MIN) {
        emit({
          line: page.metaDescriptionLine,
          message: `Meta description is ${desc.length} characters (under ${DESC_MIN})`,
          context: desc,
        });
      } else if (desc.length > DESC_MAX) {
        emit({
          line: page.metaDescriptionLine,
          message: `Meta description is ${desc.length} characters (over ${DESC_MAX}, will be truncated)`,
          context: desc.slice(0, 100) + '...',
        });
      }
    },
  }),

  siteRule({
    id: 'meta-description-duplicate',
    title: 'Duplicate meta description across pages',
    severity: 'warning',
    description: 'Reused descriptions signal low-value or templated pages.',
    check(ctx, emit) {
      const byDesc = new Map<string, string[]>();
      for (const page of ctx.pages) {
        const desc = page.metaDescription?.trim();
        if (!desc || isNoindex(page) || isUtilityPage(page)) continue;
        const key = desc.toLowerCase();
        (byDesc.get(key) ?? byDesc.set(key, []).get(key)!).push(page.relPath);
      }
      for (const [desc, paths] of byDesc) {
        if (paths.length < 2) continue;
        emit({
          relPath: paths[0]!,
          message: `${paths.length} pages share the same meta description`,
          context: desc.slice(0, 90) + (desc.length > 90 ? '...' : ''),
        });
      }
    },
  }),

  pageRule({
    id: 'canonical-missing',
    title: 'Missing canonical link',
    severity: 'warning',
    fixable: true,
    description: 'A self-referencing canonical prevents duplicate-URL dilution.',
    check(page, _ctx, emit) {
      if (isNoindex(page) || isUtilityPage(page)) return;
      if (page.canonical === null) {
        emit({
          message: 'Page has no canonical link',
          remedy: 'Add <link rel="canonical" href="..."> pointing at this page\'s URL.',
        });
      } else if (page.canonical.trim() === '') {
        emit({ line: page.canonicalLine, message: 'Canonical link has an empty href' });
      }
    },
  }),

  pageRule({
    id: 'canonical-mismatch',
    title: 'Canonical points at a different page',
    severity: 'critical',
    description: 'A canonical aimed at the wrong URL removes this page from the index.',
    check(page, ctx, emit) {
      const canonical = page.canonical?.trim();
      if (!canonical) return;
      const origin = ctx.site.config.origin;
      if (!origin) return;

      let canonicalPath: string;
      try {
        canonicalPath = new URL(canonical, origin).pathname;
      } catch {
        emit({ line: page.canonicalLine, message: 'Canonical is not a valid URL', context: canonical });
        return;
      }

      const normalise = (p: string) => (p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p);
      if (normalise(canonicalPath) !== normalise(page.urlPath)) {
        emit({
          line: page.canonicalLine,
          message: `Canonical points to ${canonicalPath} but this page serves ${page.urlPath}`,
          context: canonical,
          remedy: 'Point the canonical at this page, or confirm the duplication is intentional.',
        });
      }
    },
  }),

  pageRule({
    id: 'canonical-offsite',
    title: 'Canonical points to a different domain',
    severity: 'critical',
    description: 'An off-domain canonical hands all ranking credit to another site.',
    check(page, ctx, emit) {
      const canonical = page.canonical?.trim();
      if (!canonical || !/^https?:\/\//i.test(canonical)) return;
      const origin = ctx.site.config.origin;
      if (!origin) return;
      try {
        if (new URL(canonical).host !== new URL(origin).host) {
          emit({
            line: page.canonicalLine,
            message: `Canonical points off-domain to ${new URL(canonical).host}`,
            context: canonical,
          });
        }
      } catch {
        /* handled by canonical-mismatch */
      }
    },
  }),

  pageRule({
    id: 'noindex-present',
    title: 'Page is set to noindex',
    severity: 'critical',
    description: 'Flags noindex so an accidental one on a live page is caught.',
    check(page, _ctx, emit) {
      if (isUtilityPage(page)) return;
      if (/\bnoindex\b/.test(page.robots ?? '')) {
        emit({
          message: 'Page is excluded from search via robots meta noindex',
          context: page.robots ?? '',
          remedy: 'Remove the noindex if this page should rank.',
        });
      }
    },
  }),

  pageRule({
    id: 'lang-missing',
    title: 'Missing lang attribute on <html>',
    severity: 'warning',
    fixable: true,
    description: 'The lang attribute drives correct indexing and accessibility.',
    check(page, _ctx, emit) {
      if (!page.lang) {
        emit({ line: 1, message: '<html> has no lang attribute', remedy: 'Add lang="en" (or the correct locale).' });
      }
    },
  }),

  pageRule({
    id: 'viewport-missing',
    title: 'Missing viewport meta tag',
    severity: 'critical',
    fixable: true,
    description: 'Without a viewport tag the page is not mobile-usable.',
    check(page, _ctx, emit) {
      if (!page.viewport) {
        emit({
          message: 'Page has no viewport meta tag',
          remedy: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
        });
      }
    },
  }),

  pageRule({
    id: 'charset-missing',
    title: 'Missing charset declaration',
    severity: 'warning',
    fixable: true,
    description: 'An undeclared charset can garble non-ASCII content.',
    check(page, _ctx, emit) {
      if (!page.charset) {
        emit({ message: 'Page has no charset declaration', remedy: 'Add <meta charset="UTF-8"> as the first head element.' });
      }
    },
  }),

  pageRule({
    id: 'favicon-missing',
    title: 'No favicon link',
    severity: 'notice',
    fixable: true,
    description: 'Favicons appear in search results and browser tabs.',
    check(page, _ctx, emit) {
      if (!page.hasFaviconLink) emit({ message: 'Page declares no favicon link' });
    },
  }),
];
