import { describe, expect, test } from "bun:test"
import { redirectsFileRender } from "./redirectsFileRender.js"

describe("redirectsFileRender", () => {
  test("renders from, to and status with a 301 default", () => {
    expect(
      redirectsFileRender([
        { from: "/de", to: "/" },
        { from: "/old/*", to: "/new/:splat", status: 308 },
        { from: "/tmp", to: "https://example.de/", status: 302 },
      ]),
    ).toBe("/de  /  301\n/old/*  /new/:splat  308\n/tmp  https://example.de/  302\n")
  })
})
