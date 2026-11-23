import { describe, expect, test } from "bun:test"
import { redirectRuleTargetResolve } from "./redirectRuleTargetResolve.js"

describe("redirectRuleTargetResolve", () => {
  test("resolves exact paths", () => {
    expect(redirectRuleTargetResolve({ from: "/de", to: "/" }, "example.de", "/de")).toBe("/")
    expect(redirectRuleTargetResolve({ from: "/de", to: "/" }, "example.de", "/de/")).toBeNull()
    expect(redirectRuleTargetResolve({ from: "/de", to: "/" }, "example.de", "/other")).toBeNull()
  })

  test("resolves splats without matching the bare base", () => {
    const rule = { from: "/old/*", to: "/new/:splat" }
    expect(redirectRuleTargetResolve(rule, "example.de", "/old/a/b")).toBe("/new/a/b")
    expect(redirectRuleTargetResolve(rule, "example.de", "/old/")).toBe("/new/")
    expect(redirectRuleTargetResolve(rule, "example.de", "/old")).toBeNull()
    expect(redirectRuleTargetResolve(rule, "example.de", "/older/x")).toBeNull()
  })

  test("canonicalizes non-root trailing slashes without producing an external target", () => {
    const rule = { from: "/*/", to: "/:splat" }
    expect(redirectRuleTargetResolve(rule, "example.de", "/old/a/b/")).toBe("/old/a/b")
    expect(redirectRuleTargetResolve(rule, "example.de", "/old/a/b")).toBeNull()
    expect(redirectRuleTargetResolve(rule, "example.de", "/")).toBeNull()
    expect(redirectRuleTargetResolve(rule, "example.de", "//outside.example/")).toBeNull()
  })

  test("keeps absolute targets and drops unmatched :splat", () => {
    expect(redirectRuleTargetResolve({ from: "/x", to: "https://other.de/y" }, "example.de", "/x")).toBe(
      "https://other.de/y",
    )
    expect(redirectRuleTargetResolve({ from: "/x", to: "/y/:splat" }, "example.de", "/x")).toBe("/y/")
  })

  test("honors host restrictions case-insensitively", () => {
    const rule = { from: "/x", to: "/y", host: "old.example.de" }
    expect(redirectRuleTargetResolve(rule, "old.example.de", "/x")).toBe("/y")
    expect(redirectRuleTargetResolve(rule, "OLD.EXAMPLE.DE", "/x")).toBe("/y")
    expect(redirectRuleTargetResolve(rule, "example.de", "/x")).toBeNull()
  })
})
