import type { Context } from "hono"

/**
 * Replaces `c.res`. Assigning `c.res` directly makes Hono copy every header of the previous
 * response onto the new one, which would undo overridden headers (e.g. SSR `Cache-Control`).
 */
export function contextResponseReplace(c: Context, response: Response): void {
  c.res = undefined
  c.res = response
}
