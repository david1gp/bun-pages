import type { Context, Hono } from "hono"
import type { HttpHeaderRule } from "./rules/HttpHeaderRule.js"
import type { HttpRedirectRule } from "./rules/HttpRedirectRule.js"

export type BunPagesConfig = {
  /** Directory of the built client files, resolved against `process.cwd()` when relative. */
  readonly clientRoot: string
  /** Renders every request that no earlier pipeline step answered. Omit for static-only mode. */
  readonly ssrFetch?: (request: Request) => Response | Promise<Response>
  /** Opt in to edge caching for eligible public SSR HTML; configure all auth/session cookie names. */
  readonly ssrEdgeCache?: {
    readonly authCookieNames: readonly string[]
    readonly isPublicRequest?: (context: Context) => boolean
    readonly browserCacheControl?: string
    readonly cdnCacheControl?: string
  }
  /**
   * Return the SSR 404 unchanged after a static-file miss, e.g. for localized not-found pages.
   * Defaults to false: discard the SSR response and use the normal 404.html/SPA fallback.
   * A matching static GET/HEAD response always takes precedence.
   */
  readonly preserveSsrNotFound?: boolean
  /** Build identifier reported by the health route, e.g. the git sha of the deployed release. */
  readonly buildSha?: string
  /** Host(s) serving the canonical production site; every other host gets `X-Robots-Tag: noindex`. */
  readonly canonicalHost?: string | readonly string[]
  /** `www.example.de` → `example.de`: 301 to `https://<to>` + same path + query. */
  readonly hostRedirects?: Readonly<Record<string, string>>
  /** Ordered redirect and static 200 rewrite rules, first match wins (ex-`_redirects`). */
  readonly redirectRules?: readonly HttpRedirectRule[]
  /** Ordered header rules, all matches apply in order with later rules winning (ex-`_headers`). */
  readonly headerRules?: readonly HttpHeaderRule[]
  /** Apply header rules to static responses only (default), or to all responses for legacy behavior. */
  readonly headerRulesApplyTo?: "static" | "all"
  /** Path patterns (same `*` syntax as header rules) served from static files before SSR when present. */
  readonly staticFirst?: readonly string[]
  /** Project endpoints (ex-Pages Functions), registered before the static/SSR steps. */
  readonly routes?: (app: Hono) => void
  /** Static-only fallback (e.g. `"/spa.html"`): served with 200 when no static file and no `404.html` matched. */
  readonly spaFallback?: string
}
