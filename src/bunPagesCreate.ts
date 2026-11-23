import { Hono } from "hono"
import { resolve } from "node:path"
import type { BunPagesConfig } from "./BunPagesConfig.js"
import { healthRouteRegister } from "./health/healthRouteRegister.js"
import { hostRedirectMiddleware } from "./host/hostRedirectMiddleware.js"
import { noindexMiddleware } from "./host/noindexMiddleware.js"
import { headerRulesMiddleware } from "./rules/headerRulesMiddleware.js"
import { headerRulesApply } from "./rules/headerRulesApply.js"
import { redirectRulesRegister } from "./rules/redirectRulesRegister.js"
import { requestPublicCreate } from "./request/requestPublicCreate.js"
import { notFoundResponseCreate } from "./static/notFoundResponseCreate.js"
import { staticFirstMatches } from "./static/staticFirstMatches.js"
import { staticResponseCreate } from "./static/staticResponseCreate.js"

/**
 * Builds the origin Hono app. Pipeline: health → host redirects → redirect rules
 * and static rewrites → project routes → `staticFirst` static → SSR → static
 * fallback on SSR 404 → `404.html`; header rules apply to static responses by
 * default and `X-Robots-Tag: noindex` wraps every response.
 * Without `ssrFetch` the app runs in static-only mode with an optional SPA fallback.
 */
export function bunPagesCreate(config: BunPagesConfig): Hono {
  const clientRoot = resolve(process.cwd(), config.clientRoot)
  const app = new Hono()

  const honoFetch = app.fetch.bind(app)
  app.fetch = ((request: Request, env?: unknown, executionCtx?: unknown) =>
    honoFetch(requestPublicCreate(request), env as never, executionCtx as never)) as typeof app.fetch

  // Outer middleware post-processes last: noindex must override header rules on non-canonical hosts.
  app.use(noindexMiddleware(config.canonicalHost))
  const headerRules = config.headerRules ?? []
  const applyStaticHeaders = (response: Response, pathname: string): Response =>
    config.headerRulesApplyTo === "all" ? response : headerRulesApply(headerRules, pathname, response)
  if (config.headerRulesApplyTo === "all") app.use(headerRulesMiddleware(headerRules))
  healthRouteRegister(app, config.buildSha ?? "unknown")
  if (config.hostRedirects !== undefined && Object.keys(config.hostRedirects).length > 0) {
    app.use(hostRedirectMiddleware(config.hostRedirects))
  }
  if (config.redirectRules !== undefined)
    redirectRulesRegister(app, config.redirectRules, clientRoot, applyStaticHeaders)
  config.routes?.(app)

  app.all("*", async (c) => {
    const url = new URL(c.req.url)
    const isStaticMethod = c.req.method === "GET" || c.req.method === "HEAD"
    if (isStaticMethod && config.staticFirst !== undefined && staticFirstMatches(config.staticFirst, url.pathname)) {
      const staticFirst = await staticResponseCreate(clientRoot, url.pathname, url.search, c.req.method)
      if (staticFirst !== null) return applyStaticHeaders(staticFirst, url.pathname)
    }
    if (config.ssrFetch !== undefined) {
      let ssrResponse: Response
      try {
        ssrResponse = await config.ssrFetch(c.req.raw)
      } catch (error) {
        console.error("[bun-pages] ssrFetch threw", error)
        return c.text("SSR handler failed", 500)
      }
      if (ssrResponse.status !== 404) return ssrResponse
      if (isStaticMethod) {
        const fallback = await staticResponseCreate(clientRoot, url.pathname, url.search, c.req.method)
        if (fallback !== null) return applyStaticHeaders(fallback, url.pathname)
      }
      if (config.preserveSsrNotFound) return ssrResponse
    } else if (isStaticMethod) {
      const staticOnly = await staticResponseCreate(clientRoot, url.pathname, url.search, c.req.method)
      if (staticOnly !== null) return applyStaticHeaders(staticOnly, url.pathname)
    }
    return notFoundResponseCreate(clientRoot, config.spaFallback, (response) =>
      applyStaticHeaders(response, url.pathname),
    )
  })
  return app
}
