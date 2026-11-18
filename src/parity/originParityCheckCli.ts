import { readFile } from "node:fs/promises"
import { originParityCheck } from "./originParityCheck.js"

/** CLI for the parity check: `--a <url> --b <url> --paths-file <file> [--sitemap <url>]`. Exits 0 when clean, 1 on diffs or check errors, 2 on usage errors. */
export function originParityCheckCli(argv: readonly string[]): Promise<number> {
  return originParityCheckCliRun(argv)
}

async function originParityCheckCliRun(argv: readonly string[]): Promise<number> {
  const args = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    const value = argv[i + 1]
    if (key === undefined || !key.startsWith("--") || value === undefined || value.startsWith("--")) {
      console.error(`usage: originParityCheckCli --a <url> --b <url> --paths-file <file> [--sitemap <url>]`)
      return 2
    }
    args.set(key, value)
    i += 1
  }
  const baseUrlA = args.get("--a")
  const baseUrlB = args.get("--b")
  const pathsFile = args.get("--paths-file")
  if (baseUrlA === undefined || baseUrlB === undefined || pathsFile === undefined) {
    console.error(`usage: originParityCheckCli --a <url> --b <url> --paths-file <file> [--sitemap <url>]`)
    return 2
  }
  let pathsText: string
  try {
    pathsText = await readFile(pathsFile, "utf8")
  } catch (e) {
    console.error(`cannot read paths file ${pathsFile}: ${e instanceof Error ? e.message : String(e)}`)
    return 2
  }
  const paths = pathsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
  const result = await originParityCheck({ baseUrlA, baseUrlB, paths, sitemapUrl: args.get("--sitemap") })
  if (!result.success) {
    console.error(`${result.op}: ${result.errorMessage}`)
    return 1
  }
  if (result.data.length === 0) {
    console.log(`parity ok: ${paths.length} paths, no diffs`)
    return 0
  }
  for (const diff of result.data) console.log(`${diff.path} ${diff.field}: ${diff.a} !== ${diff.b}`)
  console.log(`parity failed: ${result.data.length} diffs over ${paths.length} paths`)
  return 1
}

if (import.meta.main) process.exit(await originParityCheckCli(Bun.argv.slice(2)))
