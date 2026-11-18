import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { originBundleBuild } from "./originBundleBuild.js"

describe("originBundleBuild", () => {
  test("bundles the entry self-contained into dist/origin/server.js", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bun-pages-bundle-"))
    const entry = join(dir, "originServer.ts")
    const outFile = join(dir, "dist", "origin", "server.js")
    writeFileSync(
      entry,
      `import { helperGreet } from "./helper.ts"\nexport default { fetch: () => new Response(helperGreet("world")) }\n`,
    )
    writeFileSync(join(dir, "helper.ts"), `export function helperGreet(name: string): string { return "hi " + name }\n`)
    const result = await originBundleBuild({ entry, outFile })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toBe(outFile)
    const bundled = Bun.file(outFile)
    expect(await bundled.exists()).toBe(true)
    expect(await bundled.text()).toContain("hi ")
  })

  test("returns an error result for a missing entry", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bun-pages-bundle-"))
    const result = await originBundleBuild({ entry: join(dir, "missing.ts"), outFile: join(dir, "server.js") })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.op).toBe("originBundleBuild")
  })
})
