import type { Hono } from "hono"
import { staticResponseCreate } from "../static/staticResponseCreate.js"
import type { HttpRedirectRule } from "./HttpRedirectRule.js"
import { redirectRuleTargetResolve } from "./redirectRuleTargetResolve.js"

/** Registers ordered redirects and, when given a client root, internal static 200 rewrites. */
export function redirectRulesRegister(
  app: Hono,
  rules: readonly HttpRedirectRule[],
  clientRoot?: string,
  staticResponseTransform: (response: Response, pathname: string) => Response = (response) => response,
): void {
  if (rules.length === 0) return
  app.use(async (c, next) => {
    const url = new URL(c.req.url)
    const hostname = (c.req.header("host") ?? url.hostname).toLowerCase()
    for (const rule of rules) {
      const target = redirectRuleTargetResolve(rule, hostname, url.pathname)
      if (target === null) continue
      if (rule.status === 200) {
        if (clientRoot === undefined || (c.req.method !== "GET" && c.req.method !== "HEAD")) return next()
        if (!target.startsWith("/") || target.startsWith("//") || target.includes("?") || target.includes("#")) {
          return next()
        }
        // A rewrite is a fallback for this URL; don't hide a real file or its canonical redirect.
        const existing = await staticResponseCreate(clientRoot, url.pathname, url.search, c.req.method)
        if (existing !== null) return staticResponseTransform(existing, url.pathname)
        const rewritten = await staticResponseCreate(clientRoot, target, "", c.req.method)
        if (rewritten?.status === 200) return staticResponseTransform(rewritten, url.pathname)
        return next()
      }
      const search = url.search
      const location =
        search === "" ? target : target.includes("?") ? `${target}&${search.slice(1)}` : `${target}${search}`
      return c.redirect(location, rule.status ?? 301)
    }
    return next()
  })
}
