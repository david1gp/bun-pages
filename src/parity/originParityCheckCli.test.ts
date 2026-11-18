import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Server } from "bun"
import { originParityCheckCli } from "./originParityCheckCli.js"

describe("originParityCheckCli", () => {
  test("exits 0 when clean, 1 on diffs, 2 on usage errors", async () => {
    const serverA: Server<undefined> = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: () => new Response("same", { headers: { "Content-Type": "text/plain" } }),
    })
    const serverB: Server<undefined> = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (request) =>
        new URL(request.url).pathname === "/changed"
          ? new Response("different", { headers: { "Content-Type": "text/plain" } })
          : new Response("same", { headers: { "Content-Type": "text/plain" } }),
    })
    const dir = mkdtempSync(join(tmpdir(), "bun-pages-paths-"))
    const pathsFile = join(dir, "paths.txt")
    writeFileSync(pathsFile, "# comment\n/\n/changed\n")
    try {
      const baseA = `http://127.0.0.1:${serverA.port}`
      const baseB = `http://127.0.0.1:${serverB.port}`
      expect(await originParityCheckCli(["--a", baseA, "--b", baseB, "--paths-file", pathsFile])).toBe(1)
      writeFileSync(pathsFile, "/\n")
      expect(await originParityCheckCli(["--a", baseA, "--b", baseA, "--paths-file", pathsFile])).toBe(0)
      expect(await originParityCheckCli(["--a", baseA])).toBe(2)
      expect(await originParityCheckCli(["--a", baseA, "--b", baseB, "--paths-file", join(dir, "nope.txt")])).toBe(2)
    } finally {
      serverA.stop()
      serverB.stop()
    }
  })
})
