import { isUtilityPage, pageRule } from './define';
import type { Rule } from '../core/types';

const REQUIRED_OG = ['title', 'description', 'image', 'url', 'type'] as const;

export const socialRules: Rule[] = [
  pageRule({
    id: 'og-missing',
    title: 'Missing Open Graph tags',
    severity: 'warning',
    fixable: true,
    description: 'Open Graph tags control how the page appears when shared.',
    check(page, _ctx, emit) {
      if (isUtilityPage(page)) return;
      const missing = REQUIRED_OG.filter((k) => !page.openGraph[k]?.trim());
      if (missing.length === REQUIRED_OG.length) {
        emit({
          message: 'Page has no Open Graph tags at all',
          remedy: 'Add og:title, og:description, og:image, og:url and og:type.',
        });
      } else if (missing.length > 0) {
        emit({
          message: `Missing Open Graph tags: ${missing.map((m) => `og:${m}`).join(', ')}`,
          remedy: 'Add the missing tags so shares render with a full preview card.',
        });
      }
    },
  }),

  pageRule({
    id: 'og-image-incomplete',
    title: 'og:image missing dimensions or alt text',
    severity: 'notice',
    fixable: true,
    description: 'Dimensions let platforms reserve layout space; alt describes the image.',
    check(page, _ctx, emit) {
      if (!page.openGraph['image']?.trim()) return;
      const missing: string[] = [];
      if (!page.openGraph['image:width']) missing.push('og:image:width');
      if (!page.openGraph['image:height']) missing.push('og:image:height');
      if (!page.openGraph['image:alt']) missing.push('og:image:alt');
      if (missing.length > 0) {
        emit({ message: `og:image is missing ${missing.join(', ')}` });
      }
    },
  }),

  pageRule({
    id: 'twitter-card-missing',
    title: 'Missing Twitter Card tags',
    severity: 'notice',
    fixable: true,
    description: 'Twitter Card tags control the preview on X and several other clients.',
    check(page, _ctx, emit) {
      if (isUtilityPage(page)) return;
      if (!page.twitter['card']) {
        emit({
          message: 'Page has no twitter:card tag',
          remedy: 'Add <meta name="twitter:card" content="summary_large_image">.',
        });
      }
    },
  }),

  pageRule({
    id: 'og-title-drift',
    title: 'og:title differs substantially from <title>',
    severity: 'notice',
    description: 'Large drift between the two usually means one was left stale.',
    check(page, _ctx, emit) {
      const ogTitle = page.openGraph['title']?.trim();
      const title = page.title?.trim();
      if (!ogTitle || !title) return;
      // Deliberately tolerant: a trailing brand suffix is a normal, intentional difference.
      const a = ogTitle.toLowerCase();
      const b = title.toLowerCase();
      if (!a.includes(b) && !b.includes(a)) {
        emit({
          message: 'og:title and <title> appear unrelated',
          context: `title: "${title}" | og:title: "${ogTitle}"`,
          remedy: 'Confirm both are current; a stale og:title misrepresents shared links.',
        });
      }
    },
  }),

  pageRule({
    id: 'og-url-mismatch',
    title: 'og:url does not match the page URL',
    severity: 'warning',
    description: 'A copied og:url points shares at the wrong page.',
    check(page, ctx, emit) {
      const ogUrl = page.openGraph['url']?.trim();
      const origin = ctx.site.config.origin;
      if (!ogUrl || !origin) return;
      try {
        const p = new URL(ogUrl, origin).pathname;
        const normalise = (x: string) => (x !== '/' && x.endsWith('/') ? x.slice(0, -1) : x);
        if (normalise(p) !== normalise(page.urlPath)) {
          emit({ message: `og:url points to ${p} but this page serves ${page.urlPath}`, context: ogUrl });
        }
      } catch {
        emit({ message: 'og:url is not a valid URL', context: ogUrl });
      }
    },
  }),
];
