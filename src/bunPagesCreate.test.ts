import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { bunPagesCreate } from "./bunPagesCreate.js"

function clientRootCreate(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "bun-pages-client-"))
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  return dir
}

const ssrEcho = (request: Request) => new Response(`ssr ${new URL(request.url).pathname} ${request.method}`)

describe("bunPagesCreate", () => {
  test("health route reports ok with the build sha and is never cached", async () => {
    const app = bunPagesCreate({ clientRoot: clientRootCreate({}), buildSha: "abc123", ssrFetch: ssrEcho })
    const response = await app.request("/__origin/health")
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(await response.json()).toEqual({ status: "ok", buildSha: "abc123" })
  })

  test("health wins over host redirects", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({}),
      hostRedirects: { "www.example.de": "example.de" },
      ssrFetch: ssrEcho,
    })
    const response = await app.request("https://www.example.de/__origin/health")
    expect(response.status).toBe(200)
  })

  test("redirects www to the apex keeping path and query", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({}),
      hostRedirects: { "www.example.de": "example.de" },
      ssrFetch: ssrEcho,
    })
    const response = await app.request("https://www.example.de/legacy/page?x=1")
    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe("https://example.de/legacy/page?x=1")
    const apex = await app.request("https://example.de/legacy/page?x=1")
    expect(await apex.text()).toBe("ssr /legacy/page GET")
  })

  test("tags non-canonical hosts with noindex keeping status and cookies", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({}),
      canonicalHost: "example.de",
      ssrFetch: () =>
        new Response("teapot", {
          status: 418,
          headers: [
            ["Content-Type", "text/plain"],
            ["Set-Cookie", "a=1; Path=/"],
            ["Set-Cookie", "b=2; Path=/"],
          ],
        }),
    })
    const preview = await app.request("https://preview.example.de/")
    expect(preview.status).toBe(418)
    expect(preview.headers.get("X-Robots-Tag")).toBe("noindex")
    expect(preview.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"])
    expect(await preview.text()).toBe("teapot")
    const canonical = await app.request("https://example.de/")
    expect(canonical.headers.get("X-Robots-Tag")).toBeNull()
  })

  test("accepts several canonical hosts", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({}),
      canonicalHost: ["example.de", "www.example.de"],
      ssrFetch: ssrEcho,
    })
    expect((await app.request("https://www.example.de/")).headers.get("X-Robots-Tag")).toBeNull()
    expect((await app.request("https://next.example.de/")).headers.get("X-Robots-Tag")).toBe("noindex")
  })

  test("applies redirect rules with splats, query strings and host restrictions", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({}),
      canonicalHost: "example.de",
      redirectRules: [
        { from: "/de", to: "/" },
        { from: "/old/*", to: "/new/:splat" },
        { from: "/s", to: "/t?fixed=1" },
        { from: "/tmp", to: "/perm", status: 307 },
        { from: "/x", to: "/y", host: "old.example.de" },
        { from: "/de", to: "/never" },
      ],
      ssrFetch: ssrEcho,
    })
    const exact = await app.request("https://example.de/de")
    expect(exact.status).toBe(301)
    expect(exact.headers.get("location")).toBe("/")
    const splat = await app.request("https://example.de/old/a/b?x=1")
    expect(splat.headers.get("location")).toBe("/new/a/b?x=1")
    const bareSplat = await app.request("https://example.de/old")
    expect(await bareSplat.text()).toBe("ssr /old GET")
    const merged = await app.request("https://example.de/s?a=2")
    expect(merged.headers.get("location")).toBe("/t?fixed=1&a=2")
    const keepMethod = await app.request("https://example.de/tmp")
    expect(keepMethod.status).toBe(307)
    expect(keepMethod.headers.get("location")).toBe("/perm")
    const foreign = await app.request("https://example.de/x")
    expect(await foreign.text()).toBe("ssr /x GET")
    const restricted = await app.request("https://old.example.de/x")
    expect(restricted.headers.get("location")).toBe("/y")
  })

  test("serves an ordered 200 rewrite without changing the URL or overriding real files", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({ "/spa.html": "SPA shell", "/app/help.html": "prerendered help" }),
      redirectRules: [
        { from: "/*/", to: "/:splat" },
        { from: "/app/*", to: "/spa", status: 200 },
        { from: "/app/deep", to: "/later" },
      ],
      headerRules: [{ path: "/app/*", headers: { "X-Robots-Tag": "noindex, follow" } }],
      ssrFetch: ssrEcho,
    })
    const shell = await app.request("/app/deep?x=1")
    expect(shell.status).toBe(200)
    expect(shell.headers.get("Location")).toBeNull()
    expect(shell.headers.get("Content-Type")).toContain("text/html")
    expect(shell.headers.get("X-Robots-Tag")).toBe("noindex, follow")
    expect(await shell.text()).toBe("SPA shell")
    const head = await app.request("/app/deep", { method: "HEAD" })
    expect(head.status).toBe(200)
    expect(await head.text()).toBe("")
    const slash = await app.request("/app/deep/?x=1")
    expect(slash.status).toBe(301)
    expect(slash.headers.get("Location")).toBe("/app/deep?x=1")
    const original = await app.request("/app/help")
    expect(original.headers.get("X-Robots-Tag")).toBe("noindex, follow")
    expect(await original.text()).toBe("prerendered help")
    expect((await app.request("/app/help.html")).headers.get("Location")).toBe("/app/help")
    expect(await (await app.request("/app/deep", { method: "POST" })).text()).toBe("ssr /app/deep POST")
  })

  test("falls through when a rewrite has no canonical local static target", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({ "/spa.html": "SPA shell" }),
      redirectRules: [
        { from: "/remote", to: "https://elsewhere.example/spa", status: 200 },
        { from: "/noncanonical", to: "/spa.html", status: 200 },
        { from: "/missing", to: "/other", status: 200 },
        { from: "/missing", to: "/later" },
      ],
      ssrFetch: ssrEcho,
    })
    for (const path of ["/remote", "/noncanonical", "/missing"]) {
      expect(await (await app.request(path)).text()).toBe(`ssr ${path} GET`)
    }
  })

  test("applies header rules only to static responses by default", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({ "/assets/app.js": "console.log(1)", "/404.html": "missing" }),
      canonicalHost: "example.de",
      headerRules: [
        { path: "/*", headers: { "Referrer-Policy": "no-referrer" } },
        { path: "/assets/*", headers: { "Cache-Control": "public, max-age=31556952, immutable" } },
      ],
      redirectRules: [{ from: "/de", to: "/" }],
      routes: (routes) => {
        routes.get("/api", (c) => c.text("route"))
      },
      ssrFetch: (request) =>
        new URL(request.url).pathname === "/page"
          ? new Response("SSR", { headers: { "Cache-Control": "private, no-store" } })
          : new Response("gone", { status: 404 }),
    })
    const ssr = await app.request("https://example.de/page")
    expect(ssr.headers.get("Referrer-Policy")).toBeNull()
    expect(ssr.headers.get("Cache-Control")).toBe("private, no-store")
    const preview = await app.request("https://preview.example.de/page")
    expect(preview.headers.get("X-Robots-Tag")).toBe("noindex")
    expect(preview.headers.get("Referrer-Policy")).toBeNull()
    expect((await app.request("https://example.de/api")).headers.get("Referrer-Policy")).toBeNull()
    const staticFile = await app.request("https://example.de/assets/app.js")
    expect(staticFile.headers.get("Referrer-Policy")).toBe("no-referrer")
    expect(staticFile.headers.get("Cache-Control")).toBe("public, max-age=31556952, immutable")
    const redirect = await app.request("https://example.de/de")
    expect(redirect.headers.get("Referrer-Policy")).toBeNull()
    const notFound = await app.request("https://example.de/missing")
    expect(notFound.status).toBe(404)
    expect(notFound.headers.get("Referrer-Policy")).toBe("no-referrer")
    expect(await notFound.text()).toBe("missing")
  })

  test("all mode applies header rules to SSR and overrides its headers", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({}),
      headerRulesApplyTo: "all",
      headerRules: [{ path: "/*", headers: { "Cache-Control": "public, max-age=0, must-revalidate" } }],
      routes: (routes) => {
        routes.get("/api", (c) => c.text("route"))
      },
      redirectRules: [{ from: "/old", to: "/new" }],
      ssrFetch: () => new Response("page", { headers: { "Cache-Control": "private", "X-Ssr": "kept" } }),
    })
    const response = await app.request("https://example.de/page")
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate")
    expect(response.headers.get("X-Ssr")).toBe("kept")
    expect((await app.request("/api")).headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate")
    expect((await app.request("/old")).headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate")
  })

  test("later header rules win and noindex wins on non-canonical hosts", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({}),
      headerRulesApplyTo: "all",
      canonicalHost: "example.de",
      headerRules: [
        { path: "/app", headers: { "X-Robots-Tag": "noindex, follow" } },
        { path: "/app", headers: { "X-Robots-Tag": "noindex, nofollow" } },
      ],
      ssrFetch: ssrEcho,
    })
    const canonical = await app.request("https://example.de/app")
    expect(canonical.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
    const preview = await app.request("https://preview.example.de/app")
    expect(preview.headers.get("X-Robots-Tag")).toBe("noindex")
  })

  test("serves staticFirst files before ssr and ssr before other static files", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({ "/.well-known/ai-catalog.json": "static-catalog", "/page.html": "static-page" }),
      staticFirst: ["/.well-known/*"],
      headerRules: [{ path: "/*", headers: { "Referrer-Policy": "no-referrer" } }],
      ssrFetch: ssrEcho,
    })
    const staticFirst = await app.request("/.well-known/ai-catalog.json")
    expect(staticFirst.headers.get("Referrer-Policy")).toBe("no-referrer")
    expect(await staticFirst.text()).toBe("static-catalog")
    expect(await (await app.request("/page")).text()).toBe("ssr /page GET")
  })

  test("falls back to static files when ssr returns 404, then to 404.html", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({ "/late.html": "static-late", "/404.html": "missing" }),
      ssrFetch: () => new Response("gone", { status: 404 }),
    })
    const fallback = await app.request("/late")
    expect(fallback.status).toBe(200)
    expect(await fallback.text()).toBe("static-late")
    const missing = await app.request("/missing")
    expect(missing.status).toBe(404)
    expect(await missing.text()).toBe("missing")
  })

  test("cancels discarded SSR 404 streams but not preserved responses", async () => {
    let cancelled = 0
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({ "/late.html": "static-late", "/404.html": "static 404" }),
      preserveSsrNotFound: true,
      ssrFetch: () =>
        new Response(
          new ReadableStream({
            cancel: () => {
              cancelled++
            },
          }),
          { status: 404 },
        ),
    })
    expect(await (await app.request("/late")).text()).toBe("static-late")
    expect(cancelled).toBe(1)
    const preserved = await app.request("/missing")
    expect(preserved.status).toBe(404)
    expect(cancelled).toBe(1)
    await preserved.body?.cancel()

    const fallbackApp = bunPagesCreate({
      clientRoot: clientRootCreate({ "/404.html": "static 404" }),
      ssrFetch: () =>
        new Response(
          new ReadableStream({
            cancel: () => {
              cancelled++
            },
          }),
          { status: 404 },
        ),
    })
    expect(await (await fallbackApp.request("/missing")).text()).toBe("static 404")
    expect(cancelled).toBe(3)
  })

  test("optionally preserves the SSR 404 without skipping the static fallback", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({ "/late.html": "static-late", "/404.html": "static 404" }),
      preserveSsrNotFound: true,
      ssrFetch: () => new Response("localized SSR 404", { status: 404 }),
    })
    expect(await (await app.request("/late")).text()).toBe("static-late")
    const missing = await app.request("/missing")
    expect(missing.status).toBe(404)
    expect(await missing.text()).toBe("localized SSR 404")
  })

  test("skips static files for non-get/head requests", async () => {
    const app = bunPagesCreate({ clientRoot: clientRootCreate({ "/about.html": "static-about" }), ssrFetch: ssrEcho })
    const post = await app.request("/about", { method: "POST" })
    expect(await post.text()).toBe("ssr /about POST")
  })

  test("serves clean urls with 308 canonical redirects", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({
        "/a.html": "page-a",
        "/a/index.html": "page-a-index",
        "/dir/index.html": "dir-index",
        "/robots.txt": "robots",
        "/index.html": "home",
      }),
      ssrFetch: () => new Response("gone", { status: 404 }),
    })
    const pageA = await app.request("/a")
    expect(await pageA.text()).toBe("page-a")
    expect(pageA.headers.get("Content-Type")).toContain("text/html")
    expect((await app.request("/a.html")).headers.get("location")).toBe("/a")
    expect((await app.request("/a.html")).status).toBe(308)
    expect((await app.request("/a/index.html")).headers.get("location")).toBe("/a/")
    expect((await app.request("/dir")).headers.get("location")).toBe("/dir/")
    expect(await (await app.request("/dir/")).text()).toBe("dir-index")
    expect(await (await app.request("/robots.txt")).text()).toBe("robots")
    expect(await (await app.request("/")).text()).toBe("home")
    expect((await app.request("/a.html?x=1")).headers.get("location")).toBe("/a?x=1")
  })

  test("blocks traversal to files outside the client root", async () => {
    const outside = mkdtempSync(join(tmpdir(), "bun-pages-outside-"))
    writeFileSync(join(outside, "secret.txt"), "top-secret")
    const client = join(outside, "client")
    mkdirSync(client, { recursive: true })
    writeFileSync(join(client, "index.html"), "home")
    const app = bunPagesCreate({ clientRoot: client, ssrFetch: () => new Response("gone", { status: 404 }) })
    for (const path of ["/..%2fsecret.txt", "/..%2Fsecret.txt", "/%2e%2e/secret.txt", "/%2E%2E%2Fsecret.txt"]) {
      const response = await app.request(`https://example.de${path}`)
      expect(response.status).toBe(404)
      expect(await response.text()).not.toContain("top-secret")
    }
  })

  test("runs project routes before ssr with the public request", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({}),
      routes: (routeApp) => {
        routeApp.get("/api/hello", (c) => c.json({ url: c.req.url }))
      },
      ssrFetch: ssrEcho,
    })
    const response = await app.request("https://example.de/api/hello")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ url: "https://example.de/api/hello" })
  })

  test("passes the public https request to ssrFetch", async () => {
    const seen: string[] = []
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({}),
      ssrFetch: (request) => {
        seen.push(`${request.method} ${request.url} ${request.headers.get("CF-Connecting-IP")}`)
        return new Response("ok")
      },
    })
    await app.request(
      new Request("http://127.0.0.1:3000/echo?a=1", {
        method: "POST",
        headers: { host: "example.de", "CF-Connecting-IP": "203.0.113.7", "Content-Type": "text/plain" },
        body: "hi",
      }),
    )
    expect(seen).toEqual(["POST https://example.de/echo?a=1 203.0.113.7"])
  })

  test("answers head requests for static files without a body", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({ "/about.html": "static-about" }),
      ssrFetch: () => new Response("gone", { status: 404 }),
    })
    const head = await app.request("/about", { method: "HEAD" })
    expect(head.status).toBe(200)
    expect(head.headers.get("Content-Type")).toContain("text/html")
    expect(await head.text()).toBe("")
  })

  test("static-only mode serves files, then 404.html, then the spa fallback", async () => {
    const app = bunPagesCreate({
      clientRoot: clientRootCreate({ "/about.html": "static-about", "/404.html": "missing" }),
    })
    expect(await (await app.request("/about")).text()).toBe("static-about")
    const missing = await app.request("/missing")
    expect(missing.status).toBe(404)
    expect(await missing.text()).toBe("missing")
    const spa = bunPagesCreate({ clientRoot: clientRootCreate({ "/spa.html": "spa-shell" }), spaFallback: "/spa.html" })
    const deepLink = await spa.request("/app/groups/x")
    expect(deepLink.status).toBe(200)
    expect(await deepLink.text()).toBe("spa-shell")
    const plain = bunPagesCreate({ clientRoot: clientRootCreate({}) })
    const plainMissing = await plain.request("/missing")
    expect(plainMissing.status).toBe(404)
    expect(plainMissing.headers.get("Content-Type")).toBe("text/plain")
  })
})
