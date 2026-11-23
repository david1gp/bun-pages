export type HttpRedirectRule = {
  /** Exact path (`/de`) or path with one splat (`/old/*` or a trailing-slash pattern). */
  readonly from: string
  /** Target (may contain `:splat`): a path or absolute URL for redirects, a clean static path for 200 rewrites. */
  readonly to: string
  readonly status?: 200 | 301 | 302 | 307 | 308
  /** When set, the rule only applies to requests whose Host header equals this hostname. */
  readonly host?: string
}
