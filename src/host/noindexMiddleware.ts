import type { MiddlewareHandler } from "hono"
import { contextResponseReplace } from "../response/contextResponseReplace.js"
import { responseHeadersApply } from "../rules/responseHeadersApply.js"

/** Tags responses on non-canonical hosts with `X-Robots-Tag: noindex`, keeping status, body and cookies untouched. */
export function noindexMiddleware(canonicalHost: string | readonly string[] | undefined): MiddlewareHandler {
  const canonical = (
    canonicalHost === undefined ? [] : typeof canonicalHost === "string" ? [canonicalHost] : [...canonicalHost]
  ).map((host) => host.toLowerCase())
  return async (c, next) => {
    await next()
    if (canonical.length === 0) return
    const host = (c.req.header("host") ?? new URL(c.req.url).hostname).toLowerCase()
    const bare = host.split(":")[0] ?? host
    if (canonical.includes(host) || canonical.includes(bare)) return
    if (c.res.status < 200 || c.res.status > 599) return
    contextResponseReplace(c, responseHeadersApply(c.res, { "X-Robots-Tag": "noindex" }))
  }
}
