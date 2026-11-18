import type { Hono } from "hono"
import type { HttpHeaderRule } from "./rules/HttpHeaderRule.js"
import type { HttpRedirectRule } from "./rules/HttpRedirectRule.js"

export type BunPagesConfig = {
  /** Directory of the built client files, resolved against `process.cwd()` when relative. */
  readonly clientRoot: string
  /** Renders every request that no earlier pipeline step answered. Omit for static-only mode. */
  readonly ssrFetch?: (request: Request) => Response | Promise<Response>
  /** Build identifier reported by the health route, e.g. the git sha of the deployed release. */
  readonly buildSha?: string
  /** Host(s) serving the canonical production site; every other host gets `X-Robots-Tag: noindex`. */
  readonly canonicalHost?: string | readonly string[]
  /** `www.example.de` → `example.de`: 301 to `https://<to>` + same path + query. */
  readonly hostRedirects?: Readonly<Record<string, string>>
  /** Ordered redirect rules, first match wins (e.g. legacy paths, ex-`_redirects`). */
  readonly redirectRules?: readonly HttpRedirectRule[]
  /** Ordered header rules, all matches apply in order with later rules winning (ex-`_headers`). */
  readonly headerRules?: readonly HttpHeaderRule[]
  /** Path patterns (same `*` syntax as header rules) served from static files before SSR when present. */
  readonly staticFirst?: readonly string[]
  /** Project endpoints (ex-Pages Functions), registered before the static/SSR steps. */
  readonly routes?: (app: Hono) => void
  /** Static-only fallback (e.g. `"/spa.html"`): served with 200 when no static file and no `404.html` matched. */
  readonly spaFallback?: string
}
