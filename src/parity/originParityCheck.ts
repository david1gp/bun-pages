import { createResult, createResultError, type Result } from "#result"
import type { OriginParityCheckOptions } from "./OriginParityCheckOptions.js"
import type { OriginParityDiff } from "./OriginParityDiff.js"

const comparedHeaders = [
  "cache-control",
  "cdn-cache-control",
  "content-type",
  "x-robots-tag",
  "referrer-policy",
] as const

/** Compares two hosts path by path (`redirect: "manual"`): status, same-host-normalized `Location`, cache/robots/content headers and sha256 of non-HTML bodies. Sitemap `<loc>` entries extend `paths`. */
export function originParityCheck(options: OriginParityCheckOptions): Promise<Result<readonly OriginParityDiff[]>> {
  return originParityCheckRun(options)
}

async function originParityCheckRun(options: OriginParityCheckOptions): Promise<Result<readonly OriginParityDiff[]>> {
  const op = "originParityCheck"
  try {
    const paths = await originParityPathsGet(options)
    const perPath = await Promise.all(
      paths.map((path) => originParityPathDiffs(options.baseUrlA, options.baseUrlB, path)),
    )
    return createResult(perPath.flat())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return createResultError(op, `parity check failed: ${msg}`, `${options.baseUrlA} vs ${options.baseUrlB}`)
  }
}

async function originParityPathsGet(options: OriginParityCheckOptions): Promise<string[]> {
  const paths = [...options.paths]
  if (options.sitemapUrl === undefined) return paths
  const response = await fetch(options.sitemapUrl)
  if (!response.ok) throw new Error(`sitemap fetch failed: ${response.status} ${options.sitemapUrl}`)
  const xml = await response.text()
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const loc = match[1]?.trim()
    if (!loc) continue
    try {
      const url = new URL(loc)
      paths.push(`${url.pathname}${url.search}`)
    } catch {
      continue
    }
  }
  return [...new Set(paths)]
}

async function originParityPathDiffs(baseUrlA: string, baseUrlB: string, path: string): Promise<OriginParityDiff[]> {
  const diffs: OriginParityDiff[] = []
  const [responseA, responseB] = await Promise.all([
    fetch(new URL(path, baseUrlA), { redirect: "manual" }),
    fetch(new URL(path, baseUrlB), { redirect: "manual" }),
  ])
  if (responseA.status !== responseB.status) {
    diffs.push({ path, field: "status", a: String(responseA.status), b: String(responseB.status) })
  }
  const locationA = originParityLocationNormalize(responseA.headers.get("location"), baseUrlA)
  const locationB = originParityLocationNormalize(responseB.headers.get("location"), baseUrlB)
  if (locationA !== locationB) diffs.push({ path, field: "location", a: locationA, b: locationB })
  for (const name of comparedHeaders) {
    const valueA = originParityHeaderNormalize(name, responseA.headers.get(name))
    const valueB = originParityHeaderNormalize(name, responseB.headers.get(name))
    if (valueA !== valueB) diffs.push({ path, field: `header:${name}`, a: valueA, b: valueB })
  }
  const typeA = responseA.headers.get("content-type") ?? ""
  const typeB = responseB.headers.get("content-type") ?? ""
  if (!typeA.toLowerCase().includes("text/html") && !typeB.toLowerCase().includes("text/html")) {
    const [hashA, hashB] = await Promise.all([originParityBodySha256(responseA), originParityBodySha256(responseB)])
    if (hashA !== hashB) diffs.push({ path, field: "body-sha256", a: hashA, b: hashB })
  }
  return diffs
}

function originParityLocationNormalize(location: string | null, baseUrl: string): string {
  if (location === null) return ""
  try {
    const url = new URL(location, baseUrl)
    if (url.origin === new URL(baseUrl).origin) return `${url.pathname}${url.search}`
  } catch {
    return location
  }
  return location
}

function originParityHeaderNormalize(name: string, value: string | null): string {
  if (value === null) return ""
  return name === "content-type" ? value.toLowerCase() : value
}

async function originParityBodySha256(response: Response): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await response.arrayBuffer())
  return Buffer.from(digest).toString("hex")
}
