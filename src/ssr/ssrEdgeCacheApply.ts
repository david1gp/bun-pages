import type { Context } from "hono"
import type { BunPagesConfig } from "../BunPagesConfig.js"

/** Add cache headers only to explicitly eligible public SSR HTML responses. */
export function ssrEdgeCacheApply(
  response: Response,
  c: Context,
  config: NonNullable<BunPagesConfig["ssrEdgeCache"]>,
): Response {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") return response
  if (response.status !== 200 || !/^text\/html(?:\s*;|\s*$)/i.test(response.headers.get("content-type") ?? ""))
    return response
  if (response.headers.has("set-cookie")) return response
  if (/(?:^|,)\s*(?:no-store|private|no-cache)(?:\s*(?:=|,|$))/i.test(response.headers.get("cache-control") ?? ""))
    return response
  const cookies = (c.req.header("cookie") ?? "").split(";").map((cookie) => cookie.trim().split("=", 1)[0])
  if (config.authCookieNames.some((name) => cookies.includes(name))) return response
  if (config.isPublicRequest && !config.isPublicRequest(c)) return response
  const headers = new Headers(response.headers)
  headers.set("Cache-Control", config.browserCacheControl ?? "public, max-age=0, must-revalidate")
  headers.set(
    "CDN-Cache-Control",
    config.cdnCacheControl ?? "max-age=60, stale-while-revalidate=300, stale-if-error=86400",
  )
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
