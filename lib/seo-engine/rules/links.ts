import { pageRule } from './define';
import type { Rule } from '../core/types';

const GENERIC_ANCHORS = new Set([
  'click here', 'here', 'read more', 'more', 'link', 'this', 'learn more',
  'find out more', 'continue', 'download', 'go', 'submit',
]);

export const linkRules: Rule[] = [
  pageRule({
    id: 'link-broken-internal',
    title: 'Broken internal link',
    severity: 'critical',
    description: 'An internal link resolving to no file on disk is a guaranteed 404.',
    check(page, ctx, emit) {
      for (const link of page.links) {
        if (link.kind !== 'internal' || link.resolvedPath !== null) continue;

        // Non-HTML assets are resolved against the full file list, since the link
        // resolver only tries HTML-shaped candidates.
        const clean = link.href.split('#')[0]!.split('?')[0]!;
        if (!clean) continue;
        const isAsset = /\.[a-z0-9]{2,5}$/i.test(clean) && !/\.html?$/i.test(clean);
        if (isAsset && [...ctx.fileSet].some((f) => f.endsWith(clean.replace(/^\//, '')))) continue;

        emit({
          line: link.line,
          message: 'Internal link does not resolve to any file',
          context: `${link.href}  ("${link.text.slice(0, 40)}")`,
          remedy: 'Fix the path or remove the link.',
        });
      }
    },
  }),

  pageRule({
    id: 'link-empty-anchor',
    title: 'Link has no anchor text',
    severity: 'warning',
    description: 'Anchor text tells crawlers what the destination is about.',
    check(page, _ctx, emit) {
      for (const link of page.links) {
        if (link.kind === 'anchor' || link.kind === 'other') continue;
        if (link.text.trim() === '') {
          // An image inside the link supplies the accessible name instead.
          const wrapsImage = page.images.some((img) => Math.abs(img.line - link.line) <= 2);
          if (wrapsImage) continue;
          emit({ line: link.line, message: 'Link has empty anchor text', context: link.href.slice(0, 80) });
        }
      }
    },
  }),

  pageRule({
    id: 'link-generic-anchor',
    title: 'Generic anchor text',
    severity: 'notice',
    description: '"Click here" passes no topical signal to the destination page.',
    check(page, _ctx, emit) {
      for (const link of page.links) {
        if (GENERIC_ANCHORS.has(link.text.trim().toLowerCase())) {
          emit({
            line: link.line,
            message: `Generic anchor text: "${link.text.trim()}"`,
            context: link.href.slice(0, 80),
            remedy: 'Describe the destination, e.g. "read our loan eligibility guide".',
          });
        }
      }
    },
  }),

  pageRule({
    id: 'link-unsafe-target-blank',
    title: 'target="_blank" without rel="noopener"',
    severity: 'warning',
    fixable: true,
    description: 'Without noopener the opened page can access window.opener.',
    check(page, _ctx, emit) {
      for (const link of page.links) {
        if (link.target !== '_blank') continue;
        const rel = link.rel?.toLowerCase() ?? '';
        if (!rel.includes('noopener')) {
          emit({
            line: link.line,
            message: 'target="_blank" without rel="noopener"',
            context: link.href.slice(0, 80),
            remedy: 'Add rel="noopener noreferrer".',
          });
        }
      }
    },
  }),

  pageRule({
    id: 'link-empty-href',
    title: 'Link with empty or placeholder href',
    severity: 'notice',
    description: 'href="#" and empty hrefs are usually unfinished markup.',
    check(page, _ctx, emit) {
      for (const link of page.links) {
        const href = link.href.trim();
        if (href === '' || href === '#') {
          emit({ line: link.line, message: `Placeholder link href="${href}"`, context: link.text.slice(0, 50) });
        }
      }
    },
  }),
];
