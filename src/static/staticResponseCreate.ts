import type { CleanUrlResult } from "./CleanUrlResult.js"
import { cleanUrlRewrite } from "./cleanUrlRewrite.js"
import { staticPathResolve } from "./staticPathResolve.js"

/** Serves a static file for a GET/HEAD request pathname (clean URLs, 308 canonical redirects), or `null` on a miss. */
export function staticResponseCreate(
  clientRoot: string,
  pathname: string,
  search: string,
  method: string,
): Promise<Response | null> {
  if (method !== "GET" && method !== "HEAD") return Promise.resolve(null)
  return staticResponseRun(clientRoot, pathname, search, method)
}

async function staticResponseRun(
  clientRoot: string,
  pathname: string,
  search: string,
  method: string,
): Promise<Response | null> {
  const rewrite: CleanUrlResult = await cleanUrlRewrite(pathname, async (subpath) => {
    const path = staticPathResolve(clientRoot, subpath)
    return path !== null && (await Bun.file(path).exists())
  })
  if (rewrite.kind === "none") return null
  if (rewrite.kind === "redirect") {
    return new Response(null, { status: 308, headers: { location: `${rewrite.location}${search}` } })
  }
  const path = staticPathResolve(clientRoot, rewrite.fileSubpath)
  if (path === null) return null
  const file = Bun.file(path)
  if (!(await file.exists())) return null
  const headers = new Headers()
  headers.set("Content-Type", file.type || "application/octet-stream")
  if (method === "HEAD") return new Response(null, { status: 200, headers })
  return new Response(file, { status: 200, headers })
}
