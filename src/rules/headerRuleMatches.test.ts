import { describe, expect, test } from "bun:test"
import { headerRuleMatches } from "./headerRuleMatches.js"

describe("headerRuleMatches", () => {
  test("matches exact paths only", () => {
    expect(headerRuleMatches("/", "/")).toBe(true)
    expect(headerRuleMatches("/", "/about")).toBe(false)
    expect(headerRuleMatches("/ratgeber", "/ratgeber")).toBe(true)
    expect(headerRuleMatches("/ratgeber", "/ratgeber/")).toBe(false)
    expect(headerRuleMatches("/ratgeber", "/ratgeber/solo")).toBe(false)
  })

  test("matches trailing splats", () => {
    expect(headerRuleMatches("/assets/*", "/assets/app.js")).toBe(true)
    expect(headerRuleMatches("/assets/*", "/assets/nested/app.js")).toBe(true)
    expect(headerRuleMatches("/assets/*", "/assets")).toBe(false)
    expect(headerRuleMatches("/ratgeber/*", "/ratgeber/solo")).toBe(true)
    expect(headerRuleMatches("/*", "/anything/at/all")).toBe(true)
  })

  test("matches mid-path wildcards", () => {
    expect(headerRuleMatches("/*.html", "/about.html")).toBe(true)
    expect(headerRuleMatches("/*.html", "/about")).toBe(false)
    expect(headerRuleMatches("/*.html", "/nested/about.html")).toBe(true)
    expect(headerRuleMatches("/ratgeber/*.css", "/ratgeber/app-abc123.css")).toBe(true)
    expect(headerRuleMatches("/ratgeber/*.css", "/ratgeber/app.css/map")).toBe(false)
  })
})
