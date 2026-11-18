import { Hono } from "hono"
import type { BunPagesConfig } from "./BunPagesConfig.js"
import { healthRouteRegister } from "./health/healthRouteRegister.js"

export function bunPagesCreate(config: BunPagesConfig): Hono {
  const app = new Hono()
  healthRouteRegister(app, config.buildSha ?? "unknown")
  app.all("*", (c) => config.ssrFetch(c.req.raw))
  return app
}
