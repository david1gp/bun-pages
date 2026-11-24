import { describe, expect, test } from "bun:test"
import { bunPagesCreate } from "../bunPagesCreate.js"

const browser = "public, max-age=0, must-revalidate"
const cdn = "max-age=60, stale-while-revalidate=300, stale-if-error=86400"

function appCreate(
  response: () => Response,
  options: {
    isPublicRequest?: (c: import("hono").Context) => boolean
    browserCacheControl?: string
    cdnCacheControl?: string
  } = {},
) {
  return bunPagesCreate({
    clientRoot: "/nonexistent",
    ssrFetch: response,
    ssrEdgeCache: { authCookieNames: ["session", "auth"], ...options },
  })
}
const html = (init: ResponseInit = {}) =>
  new Response("html", { ...init, headers: { "Content-Type": "text/html; charset=utf-8", ...init.headers } })

describe("SSR edge caching", () => {
  test.each(["GET", "HEAD"])("caches public %s HTML with defaults", async (method) => {
    const response = await appCreate(() => html()).request("/", {
      method,
      headers: { cookie: "other=1; sessionish=2" },
    })
    expect(response.headers.get("Cache-Control")).toBe(browser)
    expect(response.headers.get("CDN-Cache-Control")).toBe(cdn)
  })
  test("allows configurable cache directives", async () => {
    const response = await appCreate(() => html(), {
      browserCacheControl: "max-age=5",
      cdnCacheControl: "max-age=10",
    }).request("/")
    expect(response.headers.get("Cache-Control")).toBe("max-age=5")
    expect(response.headers.get("CDN-Cache-Control")).toBe("max-age=10")
  })
  test.each(["POST", "PUT", "DELETE"])("does not cache %s", async (method) => {
    expect((await appCreate(() => html()).request("/", { method })).headers.get("CDN-Cache-Control")).toBeNull()
  })
  test("does not cache non-200 or non-HTML responses", async () => {
    for (const response of [
      html({ status: 201 }),
      new Response("x", { headers: { "Content-Type": "application/json" } }),
    ]) {
      expect((await appCreate(() => response).request("/")).headers.get("CDN-Cache-Control")).toBeNull()
    }
  })
  test("does not cache responses setting cookies", async () => {
    const response = await appCreate(() => html({ headers: { "Set-Cookie": "a=1" } })).request("/")
    expect(response.headers.get("CDN-Cache-Control")).toBeNull()
    expect(response.headers.get("Set-Cookie")).toBe("a=1")
  })
  test.each(["no-store", "private", "no-cache", 'public, NO-CACHE="Set-Cookie"'])(
    "respects SSR Cache-Control %s",
    async (value) => {
      const response = await appCreate(() => html({ headers: { "Cache-Control": value } })).request("/")
      expect(response.headers.get("Cache-Control")).toBe(value)
      expect(response.headers.get("CDN-Cache-Control")).toBeNull()
    },
  )
  test.each(["session=abc", "other=1; auth=abc", "session="])(
    "does not cache authenticated request %s",
    async (cookie) => {
      const response = await appCreate(() => html()).request("/", { headers: { cookie } })
      expect(response.headers.get("CDN-Cache-Control")).toBeNull()
    },
  )
  test("respects path predicate", async () => {
    const app = appCreate(() => html(), { isPublicRequest: (c) => c.req.path === "/public" })
    expect((await app.request("/admin")).headers.get("CDN-Cache-Control")).toBeNull()
    expect((await app.request("/public")).headers.get("CDN-Cache-Control")).toBe(cdn)
  })
  test("is opt-in and does not affect project routes, static responses or health", async () => {
    const disabled = bunPagesCreate({ clientRoot: "/nonexistent", ssrFetch: () => html() })
    expect((await disabled.request("/")).headers.get("CDN-Cache-Control")).toBeNull()
    const app = bunPagesCreate({
      clientRoot: "/nonexistent",
      ssrFetch: () => html(),
      ssrEdgeCache: { authCookieNames: [] },
      routes: (app) => app.get("/route", (c) => c.html("x")),
    })
    expect((await app.request("/route")).headers.get("CDN-Cache-Control")).toBeNull()
    expect((await app.request("/__origin/health")).headers.get("CDN-Cache-Control")).toBeNull()
    expect((await app.request("/missing.css")).headers.get("CDN-Cache-Control")).toBe(cdn) // SSR HTML, not a static response
  })
})
