import { describe, expect, test } from "bun:test"
import type { Server } from "bun"
import { originParityCheck } from "./originParityCheck.js"

function serverStart(handler: (request: Request) => Response): Server<undefined> {
  return Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handler })
}

function baseUrl(server: Server<undefined>): string {
  return `http://127.0.0.1:${server.port}`
}

const plainHeaders = { "Content-Type": "text/plain", "Cache-Control": "no-store" }

describe("originParityCheck", () => {
  test("reports no diffs for identical hosts", async () => {
    const handler = () => new Response("hello", { headers: plainHeaders })
    const serverA = serverStart(handler)
    const serverB = serverStart(handler)
    try {
      const result = await originParityCheck({
        baseUrlA: baseUrl(serverA),
        baseUrlB: baseUrl(serverB),
        paths: ["/", "/app.js"],
      })
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data).toEqual([])
    } finally {
      serverA.stop()
      serverB.stop()
    }
  })

  test("reports header diffs with the differing values", async () => {
    const serverA = serverStart(() => new Response("hello", { headers: plainHeaders }))
    const serverB = serverStart(
      () => new Response("hello", { headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=60" } }),
    )
    try {
      const result = await originParityCheck({ baseUrlA: baseUrl(serverA), baseUrlB: baseUrl(serverB), paths: ["/"] })
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data).toEqual([
        { path: "/", field: "header:cache-control", a: "no-store", b: "public, max-age=60" },
      ])
    } finally {
      serverA.stop()
      serverB.stop()
    }
  })

  test("ignores html bodies and charset case but hashes non-html bodies", async () => {
    const htmlA = serverStart(
      () => new Response("<h1>a</h1>", { headers: { "Content-Type": "text/html; charset=UTF-8" } }),
    )
    const htmlB = serverStart(
      () => new Response("<h1>b</h1>", { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    )
    try {
      const html = await originParityCheck({ baseUrlA: baseUrl(htmlA), baseUrlB: baseUrl(htmlB), paths: ["/"] })
      expect(html.success && html.data).toEqual([])
    } finally {
      htmlA.stop()
      htmlB.stop()
    }
    const textA = serverStart(() => new Response("aaa", { headers: plainHeaders }))
    const textB = serverStart(() => new Response("bbb", { headers: plainHeaders }))
    try {
      const text = await originParityCheck({
        baseUrlA: baseUrl(textA),
        baseUrlB: baseUrl(textB),
        paths: ["/robots.txt"],
      })
      expect(text.success).toBe(true)
      if (!text.success) return
      expect(text.data.length).toBe(1)
      expect(text.data[0]?.field).toBe("body-sha256")
      expect(text.data[0]?.a).toMatch(/^[0-9a-f]{64}$/)
      expect(text.data[0]?.a).not.toBe(text.data[0]?.b)
    } finally {
      textA.stop()
      textB.stop()
    }
  })

  test("normalizes same-host redirect locations to paths", async () => {
    const serverA = serverStart((request) => {
      if (new URL(request.url).pathname === "/old") {
        return new Response(null, { status: 302, headers: { location: `${baseUrl(serverA)}/new` } })
      }
      return new Response("new", { headers: plainHeaders })
    })
    const serverB = serverStart((request) => {
      if (new URL(request.url).pathname === "/old") {
        return new Response(null, { status: 302, headers: { location: "/new" } })
      }
      return new Response("new", { headers: plainHeaders })
    })
    try {
      const result = await originParityCheck({
        baseUrlA: baseUrl(serverA),
        baseUrlB: baseUrl(serverB),
        paths: ["/old"],
      })
      expect(result.success && result.data).toEqual([])
    } finally {
      serverA.stop()
      serverB.stop()
    }
  })

  test("extends paths from the sitemap", async () => {
    let baseA = ""
    const serverA = serverStart((request) => {
      const pathname = new URL(request.url).pathname
      if (pathname === "/sitemap.xml") {
        return new Response(`<urlset><url><loc>${baseA}/extra</loc></url></urlset>`, {
          headers: { "Content-Type": "application/xml" },
        })
      }
      return new Response("same", { headers: plainHeaders })
    })
    baseA = baseUrl(serverA)
    const serverB = serverStart((request) => {
      if (new URL(request.url).pathname === "/extra") {
        return new Response("same", { headers: { "Content-Type": "text/plain", "Cache-Control": "public" } })
      }
      return new Response("same", { headers: plainHeaders })
    })
    try {
      const result = await originParityCheck({
        baseUrlA: baseA,
        baseUrlB: baseUrl(serverB),
        paths: ["/"],
        sitemapUrl: `${baseA}/sitemap.xml`,
      })
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data).toEqual([{ path: "/extra", field: "header:cache-control", a: "no-store", b: "public" }])
    } finally {
      serverA.stop()
      serverB.stop()
    }
  })
})
