import { staticPathResolve } from "./staticPathResolve.js"

/** Final fallback: `404.html` with status 404, else the SPA shell with 200, else a plain-text 404. */
export function notFoundResponseCreate(clientRoot: string, spaFallback?: string): Promise<Response> {
  return notFoundResponseRun(clientRoot, spaFallback)
}

async function notFoundResponseRun(clientRoot: string, spaFallback: string | undefined): Promise<Response> {
  const notFoundPath = staticPathResolve(clientRoot, "/404.html")
  if (notFoundPath !== null) {
    const notFoundFile = Bun.file(notFoundPath)
    if (await notFoundFile.exists()) {
      return new Response(notFoundFile, {
        status: 404,
        headers: { "Content-Type": notFoundFile.type || "text/html" },
      })
    }
  }
  if (spaFallback !== undefined) {
    const fallbackSubpath = spaFallback.startsWith("/") ? spaFallback : `/${spaFallback}`
    const fallbackPath = staticPathResolve(clientRoot, fallbackSubpath)
    if (fallbackPath !== null) {
      const fallbackFile = Bun.file(fallbackPath)
      if (await fallbackFile.exists()) {
        return new Response(fallbackFile, {
          status: 200,
          headers: { "Content-Type": fallbackFile.type || "text/html" },
        })
      }
    }
  }
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } })
}
