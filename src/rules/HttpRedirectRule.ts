export type HttpRedirectRule = {
  /** Exact path (`/de`) or prefix splat (`/old/*`, matches `/old/` and below, not `/old` itself). */
  readonly from: string
  /** Target path (may contain `:splat`) or absolute URL. The request query string is preserved. */
  readonly to: string
  readonly status?: 301 | 302 | 307 | 308
  /** When set, the rule only applies to requests whose Host header equals this hostname. */
  readonly host?: string
}
