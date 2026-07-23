# Crawl Engine

## Mission

Safely collect and normalize public website evidence without exposing the platform to SSRF, unbounded crawling, or unsafe content.

## Epics

| Epic ID | Epic | Outcome |
|---|---|---|
| CRAWL-001 | URL Safety and SSRF Guard | Block private, loopback, link-local, metadata, and unsupported targets |
| CRAWL-002 | Crawl Run Lifecycle | Create, start, progress, cancel, complete, and fail crawl runs |
| CRAWL-003 | Fetcher and Redirect Validator | Fetch pages with timeout, size limits, content-type checks, and redirect revalidation |
| CRAWL-004 | Robots and Sitemap Discovery | Discover robots and sitemap data while respecting configured policies |
| CRAWL-005 | HTML Parsing and Normalization | Extract titles, descriptions, canonicals, headings, links, images, schema, and text |
| CRAWL-006 | Link Graph Builder | Build internal/external link graph and page relationships |
| CRAWL-007 | Page Classification | Classify homepage, service page, blog, location page, landing page, legal page, and unknown |
| CRAWL-008 | Crawl Snapshot Diffing | Compare crawl runs and identify added, removed, or changed pages |
| CRAWL-009 | Crawl Error Handling | Preserve partial results and explain failures |
| CRAWL-010 | Queue and Worker Abstraction | Process crawl jobs safely with limits and retries |
| CRAWL-011 | Crawl Evidence Export | Emit evidence references for downstream engines |
| CRAWL-012 | Crawl Observability | Log timings, failures, blocked targets, and page limits |

## First Vertical Slice

Start with the smallest slice that creates evidence, produces a decision, and gives the user a meaningful next action.
