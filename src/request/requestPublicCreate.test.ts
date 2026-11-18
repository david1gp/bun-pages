import { describe, expect, test } from "bun:test"
import { requestPublicCreate } from "./requestPublicCreate.js"

describe("requestPublicCreate", () => {
  test("rebuilds the url on https://<Host> keeping path, query and headers", () => {
    const rebuilt = requestPublicCreate(
      new Request("http://127.0.0.1:3000/events/summer?x=1", { headers: { host: "example.de" } }),
    )
    expect(rebuilt.url).toBe("https://example.de/events/summer?x=1")
    expect(rebuilt.method).toBe("GET")
  })

  test("keeps method, body and client-ip headers on posts", async () => {
    const rebuilt = requestPublicCreate(
      new Request("http://127.0.0.1:3000/api/rsvp", {
        method: "POST",
        headers: { host: "example.de", "CF-Connecting-IP": "203.0.113.7", "Content-Type": "text/plain" },
        body: "hello",
      }),
    )
    expect(rebuilt.url).toBe("https://example.de/api/rsvp")
    expect(rebuilt.method).toBe("POST")
    expect(rebuilt.headers.get("CF-Connecting-IP")).toBe("203.0.113.7")
    expect(await rebuilt.text()).toBe("hello")
  })

  test("returns the request untouched without a Host header", () => {
    const request = new Request("http://127.0.0.1:3000/")
    expect(requestPublicCreate(request).url).toBe(request.url)
  })
})
