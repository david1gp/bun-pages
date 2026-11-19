import type { MiddlewareHandler } from "hono"
import { contextResponseReplace } from "../response/contextResponseReplace.js"
import type { HttpHeaderRule } from "./HttpHeaderRule.js"
import { headerRuleMatches } from "./headerRuleMatches.js"
import { responseHeadersApply } from "./responseHeadersApply.js"

/** Applies every matching header rule to each response (static, SSR, redirects, 404); later rules win. */
export function headerRulesMiddleware(rules: readonly HttpHeaderRule[]): MiddlewareHandler {
  return async (c, next) => {
    await next()
    const pathname = new URL(c.req.url).pathname
    const headers: Record<string, string> = {}
    for (const rule of rules) {
      if (headerRuleMatches(rule.path, pathname)) Object.assign(headers, rule.headers)
    }
    if (Object.keys(headers).length > 0) contextResponseReplace(c, responseHeadersApply(c.res, headers))
  }
}
