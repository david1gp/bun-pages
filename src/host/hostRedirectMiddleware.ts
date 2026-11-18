import type { MiddlewareHandler } from "hono"

/** 301s configured hosts to their canonical host, keeping the path and query string (`https://<to><path>?<query>`). */
export function hostRedirectMiddleware(hostRedirects: Readonly<Record<string, string>>): MiddlewareHandler {
  const targets = new Map(Object.entries(hostRedirects).map(([from, to]) => [from.toLowerCase(), to]))
  return async (c, next) => {
    if (targets.size === 0) return next()
    const host = (c.req.header("host") ?? new URL(c.req.url).hostname).toLowerCase()
    const bare = host.split(":")[0] ?? host
    const target = targets.get(host) ?? targets.get(bare)
    if (target === undefined) return next()
    const url = new URL(c.req.url)
    return c.redirect(`https://${target}${url.pathname}${url.search}`, 301)
  }
}
