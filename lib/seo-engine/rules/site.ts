import fs from 'node:fs';
import { siteRule } from './define';
import { isNoindex, isUtilityPage } from './define';
import type { Rule } from '../core/types';

export const siteRules: Rule[] = [
  siteRule({
    id: 'robots-txt-missing',
    title: 'Missing robots.txt',
    severity: 'warning',
    fixable: true,
    description: 'robots.txt controls crawling and advertises the sitemap location.',
    check(ctx, emit) {
      if (!ctx.site.robotsTxtPath) {
        emit({
          message: 'Site has no robots.txt',
          remedy: 'Add a robots.txt at the site root with a Sitemap: directive.',
        });
      }
    },
  }),

  siteRule({
    id: 'robots-txt-blocks-all',
    title: 'robots.txt disallows the whole site',
    severity: 'critical',
    description: 'A blanket Disallow: / removes the site from search entirely.',
    check(ctx, emit) {
      const path = ctx.site.robotsTxtPath;
      if (!path) return;
      let content: string;
      try {
        content = fs.readFileSync(path, 'utf8');
      } catch {
        return;
      }
      if (/^\s*Disallow:\s*\/\s*$/im.test(content)) {
        emit({ message: 'robots.txt contains "Disallow: /", blocking the entire site' });
      }
    },
  }),

  siteRule({
    id: 'sitemap-missing',
    title: 'Missing sitemap.xml',
    severity: 'warning',
    fixable: true,
    description: 'A sitemap helps search engines discover every page.',
    check(ctx, emit) {
      if (!ctx.site.sitemapPath) {
        emit({ message: 'Site has no sitemap.xml', remedy: 'Generate one listing every indexable page.' });
      }
    },
  }),

  siteRule({
    id: 'sitemap-out-of-sync',
    title: 'Sitemap does not match the pages on disk',
    severity: 'warning',
    fixable: true,
    description: 'A stale sitemap hides new pages and advertises deleted ones.',
    check(ctx, emit) {
      const sitemapPath = ctx.site.sitemapPath;
      if (!sitemapPath) return;

      let xml: string;
      try {
        xml = fs.readFileSync(sitemapPath, 'utf8');
      } catch {
        return;
      }

      const listed = new Set<string>();
      for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
        try {
          const p = new URL(match[1]!).pathname;
          listed.add(p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p);
        } catch {
          /* skip malformed loc entries */
        }
      }
      if (listed.size === 0) {
        emit({ message: 'Sitemap contains no <loc> entries' });
        return;
      }

      const onDisk = new Set(
        ctx.pages
          .filter((p) => !isNoindex(p) && !isUtilityPage(p))
          .map((p) => (p.urlPath !== '/' && p.urlPath.endsWith('/') ? p.urlPath.slice(0, -1) : p.urlPath)),
      );

      const missing = [...onDisk].filter((p) => !listed.has(p));
      const stale = [...listed].filter((p) => !onDisk.has(p));

      if (missing.length > 0) {
        emit({
          message: `${missing.length} pages exist on disk but are absent from the sitemap`,
          context: missing.slice(0, 8).join(', '),
        });
      }
      if (stale.length > 0) {
        emit({
          message: `${stale.length} sitemap entries have no corresponding page`,
          context: stale.slice(0, 8).join(', '),
        });
      }
    },
  }),

  siteRule({
    id: 'not-found-page-missing',
    title: 'No 404 page',
    severity: 'notice',
    description: 'A custom 404 retains visitors who hit a dead URL.',
    check(ctx, emit) {
      if (!ctx.site.notFoundPagePath) emit({ message: 'Site has no 404.html' });
    },
  }),

  siteRule({
    id: 'url-path-collision',
    title: 'Two files serve the same URL',
    severity: 'warning',
    description: 'about.html and about/index.html both serve /about — one will win unpredictably.',
    check(ctx, emit) {
      for (const [urlPath, pages] of ctx.byUrlPath) {
        if (pages.length < 2) continue;
        emit({
          relPath: pages[0]!.relPath,
          message: `${pages.length} files serve ${urlPath}`,
          context: pages.map((p) => p.relPath).join(', '),
          remedy: 'Delete the redundant file so the URL resolves deterministically.',
        });
      }
    },
  }),

  siteRule({
    id: 'page-unparseable',
    title: 'Page could not be parsed',
    severity: 'critical',
    description: 'Surfaces files the engine failed to read, so gaps are never silent.',
    check(ctx, emit) {
      for (const page of ctx.pages) {
        if (page.parseError) {
          emit({ relPath: page.relPath, message: page.parseError });
        }
      }
    },
  }),
];
