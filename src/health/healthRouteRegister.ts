import type { Hono } from "hono"
import { healthRoutePath } from "./healthRoutePath.js"

export function healthRouteRegister(app: Hono, buildSha: string): void {
  app.get(healthRoutePath, (c) => {
    c.header("Cache-Control", "no-store")
    return c.json({ status: "ok", buildSha })
  })
}
