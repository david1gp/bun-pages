export type OriginParityCheckOptions = {
  /** First host to compare (e.g. the live Pages host). */
  readonly baseUrlA: string
  /** Second host to compare (e.g. the `next.*` origin host). */
  readonly baseUrlB: string
  /** Paths (with optional query strings) to compare, e.g. `["/", "/ratgeber/solo-selbststaendig"]`. */
  readonly paths: readonly string[]
  /** Optional sitemap URL whose `<loc>` entries extend `paths`. */
  readonly sitemapUrl?: string
}
