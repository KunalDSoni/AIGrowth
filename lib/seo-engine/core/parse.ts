import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  HeadingNode,
  ImageFact,
  JsonLdBlock,
  LinkFact,
  MetaTag,
  PageFacts,
  Site,
} from './types';

/**
 * Cheerio gives us no source positions, so we recover approximate line numbers by
 * searching the raw HTML for the element's opening tag. Reports point at a line to
 * help a human find the issue; being off by one on minified markup is acceptable.
 */
function lineFinder(html: string) {
  const lines = html.split('\n');
  return (needle: string, fromLine = 0): number => {
    if (!needle) return fromLine + 1;
    const probe = needle.slice(0, 120);
    for (let i = fromLine; i < lines.length; i++) {
      if (lines[i]!.includes(probe)) return i + 1;
    }
    return fromLine + 1;
  };
}

/** Map a file path to the URL path it serves at. */
export function toUrlPath(relPath: string, prettyUrls: boolean): string {
  const posix = relPath.split(path.sep).join('/');
  if (posix === 'index.html') return '/';
  if (posix.endsWith('/index.html')) return '/' + posix.slice(0, -'/index.html'.length) + '/';
  if (prettyUrls && posix.endsWith('.html')) return '/' + posix.slice(0, -'.html'.length);
  return '/' + posix;
}

function classifyLink(href: string): LinkFact['kind'] {
  const h = href.trim();
  if (!h || h.startsWith('#')) return 'anchor';
  if (h.startsWith('mailto:')) return 'mailto';
  if (h.startsWith('tel:')) return 'tel';
  if (/^https?:\/\//i.test(h)) return 'external';
  if (/^(javascript|data):/i.test(h)) return 'other';
  if (/^\/\//.test(h)) return 'external';
  return 'internal';
}

/**
 * Resolve a site-local href to a file on disk, trying the forms a static host
 * would serve: the literal path, the path with .html appended, and the path as a
 * directory containing index.html.
 */
function resolveInternal(href: string, filePath: string, siteRoot: string): string | null {
  const clean = href.split('#')[0]!.split('?')[0]!;
  if (!clean) return null;

  const base = clean.startsWith('/') ? siteRoot : path.dirname(filePath);
  const target = path.resolve(base, clean.startsWith('/') ? '.' + clean : clean);

  const candidates = [
    target,
    `${target}.html`,
    path.join(target, 'index.html'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function resolveAsset(src: string, filePath: string, siteRoot: string): string | null {
  if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return null;
  const clean = src.split('#')[0]!.split('?')[0]!;
  if (!clean) return null;
  const base = clean.startsWith('/') ? siteRoot : path.dirname(filePath);
  const target = path.resolve(base, clean.startsWith('/') ? '.' + clean : clean);
  return fs.existsSync(target) ? target : null;
}

/** Normalised shingle hash of visible text, used for cross-page duplicate detection. */
function contentHashOf(text: string): string {
  const normalised = text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 4000);
  return crypto.createHash('sha1').update(normalised).digest('hex');
}

export function parsePage(filePath: string, site: Site): PageFacts {
  let html: string;
  try {
    html = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    const relPath = path.relative(site.root, filePath);
    return {
      ...emptyFacts(filePath, relPath, site),
      parseError: `Unreadable: ${(err as Error).message}`,
    };
  }
  return parseHtml(html, filePath, site);
}

/**
 * Parse HTML supplied as a string. Separated from parsePage so historical blobs read
 * out of git can be parsed without ever touching the working tree — Epic 13 depends
 * on this, and it also removes the temp-file round-trip the fix verifier used.
 */
export function parseHtml(html: string, filePath: string, site: Site): PageFacts {
  const relPath = path.relative(site.root, filePath);
  const prettyUrls = site.config.prettyUrls ?? true;

  const base: PageFacts = {
    filePath,
    relPath,
    urlPath: toUrlPath(relPath, prettyUrls),
    siteId: site.id,
    bytes: 0,
    lineCount: 0,
    lang: null,
    charset: null,
    viewport: null,
    title: null,
    titleLine: null,
    metaDescription: null,
    metaDescriptionLine: null,
    canonical: null,
    canonicalLine: null,
    robots: null,
    openGraph: {},
    twitter: {},
    otherMeta: [],
    headings: [],
    images: [],
    links: [],
    jsonLd: [],
    wordCount: 0,
    textSample: '',
    contentHash: '',
    hasFaviconLink: false,
    parseError: null,
  };

  base.bytes = Buffer.byteLength(html);
  base.lineCount = html.split('\n').length;

  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch (err) {
    return { ...base, parseError: `Unparseable HTML: ${(err as Error).message}` };
  }

  const findLine = lineFinder(html);

  base.lang = $('html').attr('lang')?.trim() || null;
  base.charset = $('meta[charset]').attr('charset')?.trim() || null;

  const titleEl = $('title').first();
  if (titleEl.length > 0) {
    base.title = titleEl.text().trim();
    base.titleLine = findLine('<title');
  }

  // Meta tags: split into the three buckets rules actually care about.
  $('meta').each((_, el) => {
    const $el = $(el);
    const property = $el.attr('property')?.trim().toLowerCase();
    const name = $el.attr('name')?.trim().toLowerCase();
    const content = $el.attr('content')?.trim() ?? '';

    if (property?.startsWith('og:')) {
      base.openGraph[property.slice(3)] = content;
      return;
    }
    // Twitter tags appear under `name` in the spec but `property` in the wild.
    const twitterKey = name?.startsWith('twitter:')
      ? name.slice(8)
      : property?.startsWith('twitter:')
        ? property.slice(8)
        : null;
    if (twitterKey) {
      base.twitter[twitterKey] = content;
      return;
    }

    if (!name) return;
    if (name === 'description') {
      base.metaDescription = content;
      base.metaDescriptionLine = findLine('name="description"');
    } else if (name === 'viewport') {
      base.viewport = content;
    } else if (name === 'robots') {
      base.robots = content.toLowerCase();
    } else {
      base.otherMeta.push({ name, content } satisfies MetaTag);
    }
  });

  const canonicalEl = $('link[rel="canonical"]').first();
  if (canonicalEl.length > 0) {
    base.canonical = canonicalEl.attr('href')?.trim() || '';
    base.canonicalLine = findLine('rel="canonical"');
  }

  base.hasFaviconLink = $('link[rel*="icon"]').length > 0;

  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = (el as { tagName: string }).tagName.toLowerCase();
    const level = Number(tag.slice(1)) as HeadingNode['level'];
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    base.headings.push({ level, text, line: findLine(`<${tag}`) });
  });

  $('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src')?.trim() ?? '';
    const resolvedPath = resolveAsset(src, filePath, site.root);
    let bytes: number | null = null;
    if (resolvedPath) {
      try {
        bytes = fs.statSync(resolvedPath).size;
      } catch {
        bytes = null;
      }
    }
    base.images.push({
      src,
      alt: $el.attr('alt') ?? null,
      width: $el.attr('width') ?? null,
      height: $el.attr('height') ?? null,
      loading: $el.attr('loading') ?? null,
      line: findLine(src ? `src="${src}"` : '<img'),
      resolvedPath,
      bytes,
    } satisfies ImageFact);
  });

  $('a').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href')?.trim() ?? '';
    const kind = classifyLink(href);
    base.links.push({
      href,
      text: $el.text().replace(/\s+/g, ' ').trim(),
      rel: $el.attr('rel') ?? null,
      target: $el.attr('target') ?? null,
      line: findLine(href ? `href="${href}"` : '<a'),
      kind,
      resolvedPath: kind === 'internal' ? resolveInternal(href, filePath, site.root) : null,
    } satisfies LinkFact);
  });

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    let data: unknown | null = null;
    let parseError: string | null = null;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      parseError = (err as Error).message;
    }
    base.jsonLd.push({ raw, line: findLine('application/ld+json'), data, parseError } satisfies JsonLdBlock);
  });

  // Visible text: drop anything that never renders before counting words.
  //
  // Cheerio's .text() concatenates adjacent elements with no separator, so
  // "<h2>Started</h2><span>Jul</span>" yields "StartedJul" — one nonsense token
  // instead of two real ones. That corrupts word counts, topic extraction and
  // readability alike, so a space is injected after every closing tag first.
  const spaced = html.replace(/<\/[a-z][a-z0-9-]*\s*>/gi, '$& ').replace(/<br\s*\/?>/gi, ' ');
  const $text = cheerio.load(spaced);
  $text('script, style, noscript, template, svg').remove();
  const visibleText = $text('body').text().replace(/\s+/g, ' ').trim();
  base.wordCount = visibleText ? visibleText.split(' ').filter(Boolean).length : 0;
  base.textSample = visibleText.slice(0, 12000);
  base.contentHash = contentHashOf(visibleText);

  return base;
}


/** A PageFacts with every field at its zero value, used for unreadable files. */
function emptyFacts(filePath: string, relPath: string, site: Site): PageFacts {
  return {
    filePath,
    relPath,
    urlPath: toUrlPath(relPath, site.config.prettyUrls ?? true),
    siteId: site.id,
    bytes: 0,
    lineCount: 0,
    lang: null,
    charset: null,
    viewport: null,
    title: null,
    titleLine: null,
    metaDescription: null,
    metaDescriptionLine: null,
    canonical: null,
    canonicalLine: null,
    robots: null,
    openGraph: {},
    twitter: {},
    otherMeta: [],
    headings: [],
    images: [],
    links: [],
    jsonLd: [],
    wordCount: 0,
    textSample: '',
    contentHash: '',
    hasFaviconLink: false,
    parseError: null,
  };
}
