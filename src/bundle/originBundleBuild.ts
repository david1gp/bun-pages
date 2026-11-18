import { basename, dirname, resolve } from "node:path"
import { createResult, createResultError, type Result } from "#result"
import type { OriginBundleOptions } from "./OriginBundleOptions.js"

/** Bundles the origin entry into one self-contained `server.js` (`target: "bun"`, no `node_modules` on prod). Resolves with the output file path. */
export function originBundleBuild(options: OriginBundleOptions): Promise<Result<string>> {
  return originBundleBuildRun(options)
}

async function originBundleBuildRun(options: OriginBundleOptions): Promise<Result<string>> {
  const op = "originBundleBuild"
  const entry = resolve(process.cwd(), options.entry)
  const outFile = resolve(process.cwd(), options.outFile)
  try {
    const build = await Bun.build({
      entrypoints: [entry],
      outdir: dirname(outFile),
      naming: basename(outFile),
      target: "bun",
      minify: options.minify ?? false,
    })
    if (!build.success) {
      const logs = build.logs.map((log) => `${log.level}: ${log.message}`).join("\n")
      return createResultError(op, `bun build failed: ${logs}`, outFile)
    }
    return createResult(outFile)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return createResultError(op, `bun build threw: ${msg}`, outFile)
  }
}
