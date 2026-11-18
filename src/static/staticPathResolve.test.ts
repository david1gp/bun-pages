import { describe, expect, test } from "bun:test"
import { staticPathResolve } from "./staticPathResolve.js"

const root = "/srv/app/dist/client"

describe("staticPathResolve", () => {
  test("resolves plain subpaths under the client root", () => {
    expect(staticPathResolve(root, "/assets/app.js")).toBe(`${root}/assets/app.js`)
    expect(staticPathResolve(root, "/")).toBe(root)
  })

  test("blocks directory traversal including the percent-encoded forms", () => {
    expect(staticPathResolve(root, "/../secret.txt")).toBeNull()
    expect(staticPathResolve(root, "/..%2fsecret.txt")).toBeNull()
    expect(staticPathResolve(root, "/..%2Fsecret.txt")).toBeNull()
    expect(staticPathResolve(root, "/%2e%2e/secret.txt")).toBeNull()
    expect(staticPathResolve(root, "/%2E%2E%2Fsecret.txt")).toBeNull()
    expect(staticPathResolve(root, "/a/../../secret.txt")).toBeNull()
    expect(staticPathResolve(root, "/a/%2e%2e/%2e%2e/secret.txt")).toBeNull()
  })

  test("rejects undecodable input but allows encoded separators inside the root", () => {
    expect(staticPathResolve(root, "/%zz")).toBeNull()
    expect(staticPathResolve(root, "/a%2Fb")).toBe(`${root}/a/b`)
  })
})
