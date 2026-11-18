import { describe, expect, test } from "bun:test"
import { responseHeadersApply } from "./responseHeadersApply.js"

describe("responseHeadersApply", () => {
  test("sets headers while keeping status, body and every set-cookie", async () => {
    const response = new Response("hello", {
      status: 201,
      headers: [
        ["Content-Type", "text/plain"],
        ["Set-Cookie", "a=1; Path=/"],
        ["Set-Cookie", "b=2; Path=/"],
      ],
    })
    const patched = responseHeadersApply(response, { "X-Robots-Tag": "noindex" })
    expect(patched.status).toBe(201)
    expect(await patched.text()).toBe("hello")
    expect(patched.headers.get("X-Robots-Tag")).toBe("noindex")
    expect(patched.headers.get("Content-Type")).toBe("text/plain")
    expect(patched.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"])
  })

  test("later headers overwrite and null-body statuses stay bodiless", async () => {
    const response = new Response(null, { status: 204, headers: { "X-Robots-Tag": "index" } })
    const patched = responseHeadersApply(response, { "X-Robots-Tag": "noindex" })
    expect(patched.status).toBe(204)
    expect(patched.headers.get("X-Robots-Tag")).toBe("noindex")
    expect(await patched.text()).toBe("")
  })
})
