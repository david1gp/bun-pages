import type { Server } from "bun"
import type { Hono } from "hono"
import { createResult, createResultError, type Result } from "#result"

/** Serves the app with `Bun.serve` on `HOST`/`PORT` (default 127.0.0.1:3000) and drains on SIGTERM. */
export function bunPagesStart(app: Hono): Result<Server<undefined>> {
  const op = "bunPagesStart"
  const hostname = process.env.HOST ?? "127.0.0.1"
  const portText = process.env.PORT ?? "3000"
  const port = Number(portText)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return createResultError(op, "PORT must be an integer between 1 and 65535", portText)
  }

  let server: Server<undefined>
  try {
    server = Bun.serve({ hostname, port, fetch: app.fetch })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return createResultError(op, `failed to start server: ${msg}`, `${hostname}:${portText}`)
  }

  console.log(`[bun-pages] listening on http://${hostname}:${server.port}`)
  process.once("SIGTERM", () => {
    void server.stop().then(() => process.exit(0))
  })
  return createResult(server)
}
