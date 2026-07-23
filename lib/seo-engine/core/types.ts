/**
 * The contract at the centre of the engine.
 *
 * Parsing happens exactly once per HTML file and produces a PageFacts. Every rule
 * reads from this object and nothing else — no filesystem, no network, no cheerio.
 * That is what keeps a full-portfolio scan fast, and what will make Epic 10's tests
 * trivial to write against plain object literals.
 */

export type Severity = 'critical' | 'warning' | 'notice';

export interface MetaTag {
  name: string;
  content: string;
}

export interface HeadingNode {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  line: number;
}

export interface ImageFact {
  src: string;
  alt: string | null;
  width: string | null;
  height: string | null;
  loading: string | null;
  line: number;
  /** Resolved absolute path on disk, when the src is site-local. */
  resolvedPath: string | null;
  /** File size in bytes, when resolvable. */
  bytes: number | null;
}

export interface LinkFact {
  href: string;
  text: string;
  rel: string | null;
  target: string | null;
  line: number;
  kind: 'internal' | 'external' | 'anchor' | 'mailto' | 'tel' | 'other';
  /** For internal links: the path this resolves to on disk. */
  resolvedPath: string | null;
}

export interface JsonLdBlock {
  raw: string;
  line: number;
  /** Parsed JSON, or null when the block is malformed. */
  data: unknown | null;
  parseError: string | null;
}

export interface PageFacts {
  /** Absolute path on disk. */
  filePath: string;
  /** Path relative to the site root, e.g. "blog/post.html". */
  relPath: string;
  /** The URL path this file serves at, e.g. "/blog/post" or "/". */
  urlPath: string;
  siteId: string;

  bytes: number;
  lineCount: number;

  lang: string | null;
  charset: string | null;
  viewport: string | null;

  title: string | null;
  titleLine: number | null;
  metaDescription: string | null;
  metaDescriptionLine: number | null;
  canonical: string | null;
  canonicalLine: number | null;
  robots: string | null;

  /** All og:* properties, keyed without the prefix (e.g. "title", "image"). */
  openGraph: Record<string, string>;
  /** All twitter:* properties, keyed without the prefix. */
  twitter: Record<string, string>;
  /** Every other named meta tag, in document order. */
  otherMeta: MetaTag[];

  headings: HeadingNode[];
  images: ImageFact[];
  links: LinkFact[];
  jsonLd: JsonLdBlock[];

  /** Visible text word count, scripts and styles excluded. */
  wordCount: number;
  /**
   * Leading visible text, capped. Retained for readability scoring and topic
   * extraction; the cap keeps a full-portfolio scan's memory bounded.
   */
  textSample: string;
  /** Normalised text shingle hash, for cross-page duplicate detection. */
  contentHash: string;

  hasFaviconLink: boolean;
  /** Set when the file could not be parsed at all. */
  parseError: string | null;
}

export interface SiteConfig {
  /** Canonical production origin, e.g. "https://rapidloans.ai". */
  origin?: string;
  /** Rule ids to skip for this site. */
  disabledRules?: string[];
  /** Per-rule severity overrides. */
  severityOverrides?: Record<string, Severity>;
  /** Extra ignore globs, relative to the site root. */
  ignore?: string[];
  /** Minimum word count before a page is considered thin. */
  thinContentWords?: number;
  /** Whether the site serves extensionless pretty URLs. */
  prettyUrls?: boolean;
  /** Prompts for AI-visibility checks; defaults are derived from the homepage. */
  aiPrompts?: string[];
}

export interface Site {
  id: string;
  name: string;
  root: string;
  config: SiteConfig;
  htmlFiles: string[];
  /** Pages skipped because they sit inside a vendored mirror of a third-party site. */
  excludedMirrorPages: number;
  hasGit: boolean;
  robotsTxtPath: string | null;
  sitemapPath: string | null;
  notFoundPagePath: string | null;
}

/** Everything a rule may know beyond the single page it is inspecting. */
export interface SiteContext {
  site: Site;
  /** All pages in the site, so rules can detect duplicates and orphans. */
  pages: PageFacts[];
  /** urlPath -> pages serving it, for duplicate/collision checks. */
  byUrlPath: Map<string, PageFacts[]>;
  /** Absolute paths of every file in the site, for internal link resolution. */
  fileSet: Set<string>;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  siteId: string;
  /** Null for site-level findings that belong to no single page. */
  relPath: string | null;
  line: number | null;
  message: string;
  /** The offending value, shown verbatim in reports. */
  context?: string;
  /** Human guidance on what to do about it. */
  remedy?: string;
}

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  /** "page" rules run per page; "site" rules run once per site. */
  scope: 'page' | 'site';
  /** Declared here so Epic 5 can generate patches without a redesign. */
  fixable: boolean;
  description: string;
  check(input: PageFacts | null, ctx: SiteContext): Finding[];
}
