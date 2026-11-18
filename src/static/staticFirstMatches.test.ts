import { describe, expect, test } from "bun:test"
import { staticFirstMatches } from "./staticFirstMatches.js"

describe("staticFirstMatches", () => {
  test("matches static-first patterns before SSR", () => {
    expect(staticFirstMatches(["/.well-known/*"], "/.well-known/ai-catalog.json")).toBe(true)
    expect(staticFirstMatches(["/.well-known/*", "/ratgeber", "/ratgeber/*"], "/ratgeber")).toBe(true)
    expect(staticFirstMatches(["/.well-known/*"], "/ratgeber/x")).toBe(false)
    expect(staticFirstMatches([], "/.well-known/ai-catalog.json")).toBe(false)
  })
})
