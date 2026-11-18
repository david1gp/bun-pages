import type { Hono } from "hono"
import type { HttpRedirectRule } from "./HttpRedirectRule.js"
import { redirectRuleTargetResolve } from "./redirectRuleTargetResolve.js"

/** Registers redirect rules on the app: first match wins, request query string is preserved, absolute targets allowed. */
export function redirectRulesRegister(app: Hono, rules: readonly HttpRedirectRule[]): void {
  if (rules.length === 0) return
  app.use(async (c, next) => {
    const url = new URL(c.req.url)
    const hostname = (c.req.header("host") ?? url.hostname).toLowerCase()
    for (const rule of rules) {
      const target = redirectRuleTargetResolve(rule, hostname, url.pathname)
      if (target === null) continue
      const search = url.search
      const location =
        search === "" ? target : target.includes("?") ? `${target}&${search.slice(1)}` : `${target}${search}`
      return c.redirect(location, rule.status ?? 301)
    }
    return next()
  })
}
