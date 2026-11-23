import type { MiddlewareHandler } from "hono"
import { contextResponseReplace } from "../response/contextResponseReplace.js"
import type { HttpHeaderRule } from "./HttpHeaderRule.js"
import { headerRulesApply } from "./headerRulesApply.js"

/** Applies every matching header rule to each response (static, SSR, redirects, 404); later rules win. */
export function headerRulesMiddleware(rules: readonly HttpHeaderRule[]): MiddlewareHandler {
  return async (c, next) => {
    await next()
    const response = headerRulesApply(rules, new URL(c.req.url).pathname, c.res)
    if (response !== c.res) contextResponseReplace(c, response)
  }
}
