export type OriginBundleOptions = {
  /** Origin entry file (e.g. `src/server/origin/originServer.ts`), resolved against `process.cwd()` when relative. */
  readonly entry: string
  /** Bundle output file (e.g. `dist/origin/server.js`), resolved against `process.cwd()` when relative. */
  readonly outFile: string
  readonly minify?: boolean
}
