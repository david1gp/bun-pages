import { describe, expect, test } from "bun:test"
import { headersFileRender } from "./headersFileRender.js"
import type { HttpHeaderRule } from "./HttpHeaderRule.js"

// Snapshot of /projects/eventoren/public/_headers (2026-11-18): the first TS
// conversion must render byte-identical output, proving no behavior change.
const eventorenHeaderRules = [
  { path: "/", headers: { "Cache-Control": "public, max-age=0, must-revalidate" } },
  { path: "/*.html", headers: { "Cache-Control": "public, max-age=0, must-revalidate" } },
  { path: "/ratgeber", headers: { "Cache-Control": "public, max-age=0, must-revalidate" } },
  { path: "/ratgeber/*", headers: { "Cache-Control": "public, max-age=0, must-revalidate" } },
  { path: "/en/guides", headers: { "Cache-Control": "public, max-age=0, must-revalidate" } },
  { path: "/en/guides/*", headers: { "Cache-Control": "public, max-age=0, must-revalidate" } },
  { path: "/llms.txt", headers: { "Cache-Control": "public, max-age=0, must-revalidate" } },
  { path: "/site.webmanifest", headers: { "Cache-Control": "public, max-age=604800" } },
  { path: "/assets/*", headers: { "Cache-Control": "public, max-age=31556952, immutable" } },
  { path: "/images/*", headers: { "Cache-Control": "public, max-age=31556952, immutable" } },
  { path: "/videos/*", headers: { "Cache-Control": "public, max-age=31556952, immutable" } },
  { path: "/fonts/*", headers: { "Cache-Control": "public, max-age=31556952, immutable" } },
] as const satisfies readonly HttpHeaderRule[]

const eventorenHeadersFile = `/
  Cache-Control: public, max-age=0, must-revalidate
/*.html
  Cache-Control: public, max-age=0, must-revalidate
/ratgeber
  Cache-Control: public, max-age=0, must-revalidate
/ratgeber/*
  Cache-Control: public, max-age=0, must-revalidate
/en/guides
  Cache-Control: public, max-age=0, must-revalidate
/en/guides/*
  Cache-Control: public, max-age=0, must-revalidate
/llms.txt
  Cache-Control: public, max-age=0, must-revalidate
/site.webmanifest
  Cache-Control: public, max-age=604800
/assets/*
  Cache-Control: public, max-age=31556952, immutable
/images/*
  Cache-Control: public, max-age=31556952, immutable
/videos/*
  Cache-Control: public, max-age=31556952, immutable
/fonts/*
  Cache-Control: public, max-age=31556952, immutable
`

describe("headersFileRender", () => {
  test("renders the eventoren rules byte-identical to public/_headers", () => {
    expect(headersFileRender(eventorenHeaderRules)).toBe(eventorenHeadersFile)
  })

  test("renders multi-header rules in insertion order", () => {
    expect(
      headersFileRender([
        {
          path: "/allgroups/*",
          headers: {
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        },
      ]),
    ).toBe(
      "/allgroups/*\n  Referrer-Policy: no-referrer\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n",
    )
  })
})
