import { isUtilityPage, isNoindex, siteRule } from './define';
import type { PageFacts, Rule, SiteContext } from '../core/types';

/**
 * The internal link graph, computed once per site rule invocation.
 *
 * Edges are keyed by absolute file path because that is what the parser already
 * resolved links to — matching on URL strings would need to re-derive every href
 * form the site uses (pretty URLs, index.html, trailing slashes) and would silently
 * miss whichever variant was not anticipated.
 */
interface LinkGraph {
  outbound: Map<string, Set<string>>;
  inbound: Map<string, Set<string>>;
  /** Click depth from the homepage; Infinity when unreachable. */
  depth: Map<string, number>;
  homepage: PageFacts | null;
}

function buildGraph(ctx: SiteContext): LinkGraph {
  const outbound = new Map<string, Set<string>>();
  const inbound = new Map<string, Set<string>>();

  for (const page of ctx.pages) {
    outbound.set(page.filePath, new Set());
    inbound.set(page.filePath, new Set());
  }

  for (const page of ctx.pages) {
    for (const link of page.links) {
      if (link.kind !== 'internal' || !link.resolvedPath) continue;
      if (link.resolvedPath === page.filePath) continue; // self-link
      if (!outbound.has(link.resolvedPath)) continue; // links to a non-HTML asset
      outbound.get(page.filePath)!.add(link.resolvedPath);
      inbound.get(link.resolvedPath)!.add(page.filePath);
    }
  }

  const homepage =
    ctx.pages.find((p) => p.urlPath === '/') ?? ctx.pages.find((p) => p.relPath === 'index.html') ?? null;

  // Breadth-first from the homepage gives true click depth.
  const depth = new Map<string, number>();
  if (homepage) {
    depth.set(homepage.filePath, 0);
    let frontier = [homepage.filePath];
    let current = 0;
    while (frontier.length > 0) {
      current++;
      const next: string[] = [];
      for (const node of frontier) {
        for (const target of outbound.get(node) ?? []) {
          if (depth.has(target)) continue;
          depth.set(target, current);
          next.push(target);
        }
      }
      frontier = next;
    }
  }

  return { outbound, inbound, depth, homepage };
}

const MAX_HEALTHY_DEPTH = 3;

export const graphRules: Rule[] = [
  siteRule({
    id: 'page-orphaned',
    title: 'Orphan page — nothing links to it',
    severity: 'warning',
    description:
      'A page no other page links to is effectively invisible: crawlers reach it only ' +
      'via the sitemap, and it receives no internal link equity.',
    check(ctx, emit) {
      const graph = buildGraph(ctx);
      if (!graph.homepage) return;

      for (const page of ctx.pages) {
        if (page.parseError || isUtilityPage(page) || isNoindex(page)) continue;
        if (page.filePath === graph.homepage.filePath) continue;
        const incoming = graph.inbound.get(page.filePath);
        if (!incoming || incoming.size === 0) {
          emit({
            relPath: page.relPath,
            message: 'No other page links to this page',
            remedy: 'Link to it from a relevant page, or remove it if obsolete.',
          });
        }
      }
    },
  }),

  siteRule({
    id: 'page-unreachable',
    title: 'Page unreachable from the homepage',
    severity: 'warning',
    description: 'A page with inbound links that still cannot be walked to from the homepage.',
    check(ctx, emit) {
      const graph = buildGraph(ctx);
      if (!graph.homepage) return;

      for (const page of ctx.pages) {
        if (page.parseError || isUtilityPage(page) || isNoindex(page)) continue;
        if (page.filePath === graph.homepage.filePath) continue;
        // Orphans are already reported; this is specifically about reachability.
        const incoming = graph.inbound.get(page.filePath);
        if (!incoming || incoming.size === 0) continue;
        if (!graph.depth.has(page.filePath)) {
          emit({
            relPath: page.relPath,
            message: 'Page cannot be reached by following links from the homepage',
          });
        }
      }
    },
  }),

  siteRule({
    id: 'page-too-deep',
    title: 'Page buried too deep in the click path',
    severity: 'notice',
    description: 'Pages more than three clicks from the homepage are crawled less often.',
    check(ctx, emit) {
      const graph = buildGraph(ctx);
      if (!graph.homepage) return;

      for (const [filePath, depth] of graph.depth) {
        if (depth <= MAX_HEALTHY_DEPTH) continue;
        const page = ctx.pages.find((p) => p.filePath === filePath);
        if (!page || isUtilityPage(page)) continue;
        emit({
          relPath: page.relPath,
          message: `Page is ${depth} clicks from the homepage`,
          remedy: 'Link to it from a higher-level page to shorten the path.',
        });
      }
    },
  }),

  siteRule({
    id: 'page-under-linked',
    title: 'Substantial page with very few internal links',
    severity: 'notice',
    description:
      'Internal links distribute ranking signal. A long page with one inbound link is ' +
      'being under-supported relative to the effort that went into it.',
    check(ctx, emit) {
      const graph = buildGraph(ctx);
      if (ctx.pages.length < 5) return; // Meaningless on a tiny site.

      for (const page of ctx.pages) {
        if (page.parseError || isUtilityPage(page) || page.wordCount < 600) continue;
        const incoming = graph.inbound.get(page.filePath)?.size ?? 0;
        if (incoming > 0 && incoming < 2) {
          emit({
            relPath: page.relPath,
            message: `Substantial page (${page.wordCount} words) has only ${incoming} inbound internal link`,
          });
        }
      }
    },
  }),

  siteRule({
    id: 'page-dead-end',
    title: 'Dead-end page with no outbound internal links',
    severity: 'notice',
    description: 'A page linking nowhere traps crawlers and readers.',
    check(ctx, emit) {
      const graph = buildGraph(ctx);
      if (ctx.pages.length < 3) return;

      for (const page of ctx.pages) {
        if (page.parseError || isUtilityPage(page)) continue;
        const outgoing = graph.outbound.get(page.filePath)?.size ?? 0;
        if (outgoing === 0) {
          emit({ relPath: page.relPath, message: 'Page has no outbound internal links' });
        }
      }
    },
  }),
];
