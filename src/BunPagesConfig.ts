export type BunPagesConfig = {
  /** Renders every request that no earlier pipeline step answered, e.g. `server.fetch(request, { context })`. */
  ssrFetch: (request: Request) => Response | Promise<Response>
  /** Build identifier reported by the health route, e.g. the git sha of the deployed release. */
  buildSha?: string
}
