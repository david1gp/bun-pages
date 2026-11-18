import { describe, expect, test } from "bun:test"
import { cleanUrlRewrite } from "./cleanUrlRewrite.js"

function existsStub(files: readonly string[]): (subpath: string) => boolean {
  return (subpath) => files.includes(subpath)
}

describe("cleanUrlRewrite", () => {
  test("serves extensionless files, .html and index files in order", async () => {
    const exists = existsStub(["/robots.txt", "/a.html", "/dir/index.html"])
    expect(await cleanUrlRewrite("/robots.txt", exists)).toEqual({ kind: "serve", fileSubpath: "/robots.txt" })
    expect(await cleanUrlRewrite("/a", exists)).toEqual({ kind: "serve", fileSubpath: "/a.html" })
    expect(await cleanUrlRewrite("/", existsStub(["/index.html"]))).toEqual({
      kind: "serve",
      fileSubpath: "/index.html",
    })
    expect(await cleanUrlRewrite("/dir/", exists)).toEqual({ kind: "serve", fileSubpath: "/dir/index.html" })
  })

  test("prefers the exact file and the .html file over the directory index", async () => {
    expect(await cleanUrlRewrite("/a", existsStub(["/a", "/a.html", "/a/index.html"]))).toEqual({
      kind: "serve",
      fileSubpath: "/a",
    })
    expect(await cleanUrlRewrite("/a", existsStub(["/a.html", "/a/index.html"]))).toEqual({
      kind: "serve",
      fileSubpath: "/a.html",
    })
  })

  test("canonicalizes .html and index.html urls with 308", async () => {
    const exists = existsStub(["/a.html", "/a/index.html"])
    expect(await cleanUrlRewrite("/a.html", exists)).toEqual({ kind: "redirect", location: "/a" })
    expect(await cleanUrlRewrite("/a/index.html", exists)).toEqual({ kind: "redirect", location: "/a/" })
    expect(await cleanUrlRewrite("/missing.html", exists)).toEqual({ kind: "none" })
  })

  test("redirects bare directory paths to the trailing slash", async () => {
    expect(await cleanUrlRewrite("/dir", existsStub(["/dir/index.html"]))).toEqual({
      kind: "redirect",
      location: "/dir/",
    })
    expect(await cleanUrlRewrite("/missing", existsStub([]))).toEqual({ kind: "none" })
    expect(await cleanUrlRewrite("/dir/", existsStub([]))).toEqual({ kind: "none" })
  })
})
