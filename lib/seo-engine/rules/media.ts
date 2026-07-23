import { pageRule } from './define';
import type { Rule } from '../core/types';

const LARGE_IMAGE_BYTES = 300 * 1024;

export const mediaRules: Rule[] = [
  pageRule({
    id: 'img-alt-missing',
    title: 'Image missing alt attribute',
    severity: 'warning',
    description: 'Alt text is required for accessibility and helps image search.',
    check(page, _ctx, emit) {
      for (const img of page.images) {
        if (img.alt === null) {
          emit({
            line: img.line,
            message: 'Image has no alt attribute',
            context: img.src.slice(0, 80),
            remedy: 'Add descriptive alt text, or alt="" if the image is decorative.',
          });
        }
      }
    },
  }),

  pageRule({
    id: 'img-alt-empty',
    title: 'Image has empty alt text',
    severity: 'notice',
    description: 'An empty alt marks an image decorative — correct sometimes, an oversight often.',
    check(page, _ctx, emit) {
      // Only worth flagging when the filename suggests real content rather than a
      // spacer or icon, otherwise this fires on every legitimately decorative asset.
      const meaningful = /\b(hero|banner|product|team|logo|photo|screenshot|chart|graph)\b/i;
      for (const img of page.images) {
        if (img.alt === '' && meaningful.test(img.src)) {
          emit({ line: img.line, message: 'Content image has empty alt text', context: img.src.slice(0, 80) });
        }
      }
    },
  }),

  pageRule({
    id: 'img-dimensions-missing',
    title: 'Image missing width/height',
    severity: 'notice',
    fixable: true,
    description: 'Explicit dimensions prevent layout shift, a Core Web Vitals factor.',
    check(page, _ctx, emit) {
      for (const img of page.images) {
        if (img.src.startsWith('data:')) continue;
        if (!img.width || !img.height) {
          emit({
            line: img.line,
            message: 'Image has no width/height attributes (layout shift risk)',
            context: img.src.slice(0, 80),
          });
        }
      }
    },
  }),

  pageRule({
    id: 'img-oversized',
    title: 'Oversized image file',
    severity: 'warning',
    description: 'Large images slow Largest Contentful Paint on mobile connections.',
    check(page, _ctx, emit) {
      for (const img of page.images) {
        if (img.bytes !== null && img.bytes > LARGE_IMAGE_BYTES) {
          emit({
            line: img.line,
            message: `Image is ${Math.round(img.bytes / 1024)}KB (over ${LARGE_IMAGE_BYTES / 1024}KB)`,
            context: img.src.slice(0, 80),
            remedy: 'Compress, resize, or serve WebP/AVIF.',
          });
        }
      }
    },
  }),

  pageRule({
    id: 'img-broken-src',
    title: 'Image source does not exist',
    severity: 'critical',
    description: 'A local image path that resolves to nothing renders as a broken image.',
    check(page, _ctx, emit) {
      for (const img of page.images) {
        const isLocal = img.src && !/^(https?:)?\/\//i.test(img.src) && !img.src.startsWith('data:');
        if (isLocal && img.resolvedPath === null) {
          emit({ line: img.line, message: 'Image file not found on disk', context: img.src.slice(0, 80) });
        }
      }
    },
  }),
];
