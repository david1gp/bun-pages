# @adaptive-ds/bun-pages

[![npm](https://img.shields.io/npm/v/@adaptive-ds/bun-pages)](https://www.npmjs.com/package/@adaptive-ds/bun-pages)
[![license](https://img.shields.io/npm/l/@adaptive-ds/bun-pages)](./LICENSE)

**Serve SSR web apps from your own Bun origin, with Cloudflare kept in front.**

Host rules, redirects, header rules, clean-URL static files and SSR in one small [Hono](https://hono.dev) app. It gives the same responses as Cloudflare Pages, without Worker invocations or the 100k/day Workers Free limit.

```text
browser ──► Cloudflare edge (TLS, WAF, cache, compression)
              ▼ cache miss
         Cloudflare Tunnel ──► Bun on your server
                                 bunPagesCreate(config)
                                   health → host rules → redirects → routes
                                   → static → SSR → 404, header rules on every response
```

## Why

Cloudflare Pages runs SSR in a `_worker.js`, and on the free plan every request counts toward a shared daily limit. That includes `/assets/*`, fonts and images unless you have a `_routes.json`. When the limit runs out, **every** SSR site on the account goes down.

The worker wrappers themselves are tiny, usually around `server.fetch(request, { context })`, which is plain web `fetch` and runs on Bun unchanged. `bun-pages` turns that logic into typed config:

- **Same output, not Pages emulation.** No `env.ASSETS` shim and no Cache API or `waitUntil` polyfills. A parity crawler compares status codes, `Location` and headers against the live Pages host instead.
- **One code path for preview and prod.** The preview server and the production origin run the same app, so a preview is a real prod rehearsal.
- **Policy as TypeScript.** Header and redirect rules are typed lists you can unit-test. A `_headers` file can be generated from them to keep a Pages rollback target.
- **Cloudflare stays useful.** DNS, TLS, DDoS protection, edge cache (`CDN-Cache-Control`) and compression are unchanged. Proxied traffic is not a Worker invocation.

## Install

```bash
bun add @adaptive-ds/bun-pages @adaptive-ds/result valibot
```

## Usage

```ts
// src/server/origin/originServer.ts
import { bunPagesCreate } from "@adaptive-ds/bun-pages/bunPagesCreate"
import { bunPagesStart } from "@adaptive-ds/bun-pages/bunPagesStart"
import server from "../../../dist/server/server.js"

const app = bunPagesCreate({
  buildSha: process.env.BUILD_SHA,
  ssrFetch: (request) => server.fetch(request, { context: { convexUrl: process.env.CONVEX_URL } }),
})

const started = bunPagesStart(app) // HOST / PORT env, default 127.0.0.1:3000, drains on SIGTERM
if (!started.success) {
  console.error(started.errorMessage, started.errorData)
  process.exit(1)
}
```

```bash
curl http://127.0.0.1:3000/__origin/health
# {"status":"ok","buildSha":"3f2c1ab"}
```

Fallible functions return a [`Result`](https://github.com/david1gp/result) instead of throwing.

## API

| export | description |
|---|---|
| `bunPagesCreate(config)` | Builds the Hono app for a `BunPagesConfig` |
| `bunPagesStart(app)` | `Bun.serve` on `HOST`/`PORT`, graceful stop on SIGTERM, returns `Result<Server>` |
| `BunPagesConfig` | `{ ssrFetch, buildSha? }` |
| `healthRoutePath` | `/__origin/health`, used for deploy health checks (`Cache-Control: no-store`) |
| `healthRouteRegister(app, buildSha)` | Adds the health route to an existing Hono app |

## Roadmap

`bun-pages` is early. Health and SSR work today. Next up:

- [ ] Host rules: `www` → apex 301, `X-Robots-Tag: noindex` on non-canonical hosts
- [ ] Typed redirect rules (replace `_redirects`)
- [ ] Typed header rules applied to static and SSR responses, plus a `_headers` renderer
- [ ] Static files via `hono/bun` `serveStatic` with clean URLs and `staticFirst` patterns
- [ ] Rebuild the request on its public `https://<Host>` origin and keep `CF-Connecting-IP`
- [ ] `404.html` fallback and path traversal protection
- [ ] `Bun.build` origin bundle (`dist/origin/server.js`, no `node_modules` on the server)
- [ ] `originParityCheck` crawler that diffs two hosts (Pages vs. origin)

## Development

```bash
bun install
bun run dev       # tests in watch mode
bun run test      # bun test
bun run build     # emit dist/ with type declarations
bun run format    # biome
bun run deploy    # local preflight: format check, typecheck, test, build
bun run release   # changelog via git-cliff, version bump, tag, GitHub release → npm publish via CI
```

## License

[MIT](./LICENSE) © David Siewert
