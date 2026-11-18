import { describe, expect, test } from "bun:test"
import { bunPagesCreate } from "./bunPagesCreate.js"

const app = bunPagesCreate({
  buildSha: "abc123",
  ssrFetch: (request) => new Response(`ssr ${new URL(request.url).pathname}`),
})

describe("bunPagesCreate", () => {
  test("health route reports ok with the build sha and is never cached", async () => {
    const response = await app.request("/__origin/health")
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(await response.json()).toEqual({ status: "ok", buildSha: "abc123" })
  })

  test("any other request is rendered by the SSR handler", async () => {
    const response = await app.request("/events/summer?x=1")
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("ssr /events/summer")
  })
})
