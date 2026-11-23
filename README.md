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
                                   health → host rules → redirects/rewrites → routes
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
// src/server/origin/originApp.ts
import { bunPagesCreate } from "@adaptive-ds/bun-pages/bunPagesCreate"
import { bunPagesStart } from "@adaptive-ds/bun-pages/bunPagesStart"
import server from "../../../dist/server/server.js"

export const originApp = bunPagesCreate({
  clientRoot: "dist/client",
  ssrFetch: (request) => server.fetch(request, { context: { convexUrl: process.env.CONVEX_URL } }),
  buildSha: process.env.BUILD_SHA,
  canonicalHost: "example.de", // other hosts get X-Robots-Tag: noindex
  hostRedirects: { "www.example.de": "example.de" }, // 301, keeps path + query
  redirectRules, // TS, ex-_redirects / legacy paths
  headerRules, // TS, ex-_headers
  staticFirst: ["/.well-known/*"], // served before SSR when present
  routes: (app) => {
    // project endpoints (ex-Pages Functions)
    app.get("/login/authworks/callback", authworksCallback)
  },
})

// entry: bunPagesStart(originApp) → Bun.serve, HOST/PORT env, SIGTERM drain
const started = bunPagesStart(originApp)
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

## Request pipeline

`health → host redirects → redirect/rewrite rules → project routes → staticFirst static → SSR → static fallback on SSR 404 → 404.html`. By default, header rules apply only to responses served from `clientRoot`, including static rewrites, static fallbacks and `404.html`; they do not apply to SSR, project routes, or other responses. Rules match the original request path even for rewrites. Set `headerRulesApplyTo: "all"` to restore the previous behavior of applying rules to every response. `X-Robots-Tag: noindex` on non-canonical hosts wraps every response and takes precedence over header rules. Responses are cloned before headers are set, so immutable headers and `set-cookie` survive.

Use a rule such as `{ from: "/app/*", to: "/spa", status: 200 }` to serve the static SPA shell at matching `GET`/`HEAD` URLs without redirecting the browser. The original path still determines the response header rules. A real file at that path (including its clean-URL redirect) wins over the rewrite. The target must be a canonical local static path (e.g. `/spa` for `spa.html`); if it cannot be served, processing continues with project routes and the regular static/SSR pipeline, not with another redirect rule.

Set `preserveSsrNotFound: true` to keep the application's SSR 404 response after a static miss, for example when the response is localized.

Without `ssrFetch` the app runs in static-only mode: static files, then `404.html` (status 404), then the optional `spaFallback` (e.g. `/spa.html`, status 200), then a plain-text 404.

Every downstream handler sees the request rebuilt on its public `https://<Host>` origin (the tunnel delivers plain http to 127.0.0.1); method, headers (including `CF-Connecting-IP`) and body are kept.

## Static files and clean URLs

Static serving is traversal-safe (percent-encoded `..` included) and answers `GET`/`HEAD` only. Clean URLs follow Cloudflare Pages for the files our builds emit:

| request | result |
|---|---|
| `/a` | serves `a.html` (or `a/index.html`) |
| `/a.html` | `308` to `/a` |
| `/a/index.html` | `308` to `/a/` |
| `/dir` (only `dir/index.html` exists) | `308` to `/dir/` |
| `/dir/` | serves `dir/index.html` |

Query strings are preserved on `308` redirects. There is no ETag/`304` handling; Cloudflare edge caching covers that.

## API

| export | description |
|---|---|
| `bunPagesCreate(config)` | Builds the Hono app for a `BunPagesConfig` |
| `bunPagesStart(app)` | `Bun.serve` on `HOST`/`PORT`, logs the address, drains on SIGTERM, returns `Result<Server>` |
| `BunPagesConfig` | `{ clientRoot, ssrFetch?, preserveSsrNotFound?, buildSha?, canonicalHost?, hostRedirects?, redirectRules?, headerRules?, headerRulesApplyTo?, staticFirst?, routes?, spaFallback? }` |
| `HttpRedirectRule` | `{ from, to, status?, host? }`; `from` exact or one splat (`/old/*`, `/*/`); `to` may contain `:splat`. Redirects allow absolute targets and preserve the query; status `200` serves a local static target in place. |
| `HttpHeaderRule` | `{ path, headers }`; `path` exact or with `*` wildcards like Pages `_headers` |
| `headersFileRender(rules)` | Renders rules to Pages `_headers` text (transition/rollback target) |
| `redirectsFileRender(rules)` | Renders rules to Pages `_redirects` text (host restrictions are dropped) |
| `headerRuleMatches(pattern, pathname)` | Pages-style `*` path matching |
| `redirectRuleTargetResolve(rule, hostname, pathname)` | First-match redirect target with `:splat` substituted, or `null` |
| `redirectRulesRegister(app, rules, clientRoot?)` | Registers ordered rules (first match wins); `clientRoot` enables static 200 rewrites |
| `headerRulesMiddleware(rules)` | Applies all matching header rules to every response, later rules win |
| `hostRedirectMiddleware(hostRedirects)` | `www` → apex 301 to `https://<to>` + path + query |
| `noindexMiddleware(canonicalHost)` | `X-Robots-Tag: noindex` on non-canonical hosts, status/body/cookies kept |
| `requestPublicCreate(request)` | Rebuilds the request on `https://<Host>` |
| `cleanUrlRewrite(pathname, fileExists)` | Pure clean-URL mapping (`serve` / `redirect` / `none`) |
| `CleanUrlResult` | Outcome of `cleanUrlRewrite` |
| `staticPathResolve(clientRoot, subpath)` | Traversal-safe path resolution, `null` on escape |
| `staticResponseCreate(clientRoot, pathname, search, method)` | Static file or `308` response, `null` on miss |
| `staticFirstMatches(patterns, pathname)` | Whether a path is served before SSR |
| `notFoundResponseCreate(clientRoot, spaFallback?)` | `404.html` → SPA fallback → plain-text 404 |
| `responseHeadersApply(response, headers)` | Header-setting response clone preserving `set-cookie` |
| `originBundleBuild({ entry, outFile, minify? })` | `Bun.build` origin bundle (`target: "bun"`), returns `Result<outFile>` |
| `OriginBundleOptions` | Bundle input options |
| `originParityCheck({ baseUrlA, baseUrlB, paths, sitemapUrl? })` | Diffs status, `Location`, cache/robots/content headers and non-HTML body sha256; returns `Result<diffs>` |
| `OriginParityCheckOptions` | Parity input options |
| `OriginParityDiff` | `{ path, field, a, b }` |
| `originParityCheckCli(argv)` | CLI: `--a --b --paths-file [--sitemap]`; runnable via `bun` |
| `healthRoutePath` | `/__origin/health`, used for deploy health checks (`Cache-Control: no-store`) |
| `healthRouteRegister(app, buildSha)` | Adds the health route to an existing Hono app |

## Roadmap

- [x] Host rules: `www` → apex 301, `X-Robots-Tag: noindex` on non-canonical hosts
- [x] Typed redirect rules (replace `_redirects`)
- [x] Typed header rules applied to static and SSR responses, plus a `_headers` renderer
- [x] Static files with clean URLs and `staticFirst` patterns
- [x] Rebuild the request on its public `https://<Host>` origin and keep `CF-Connecting-IP`
- [x] `404.html` fallback and path traversal protection
- [x] `Bun.build` origin bundle (`dist/origin/server.js`, no `node_modules` on the server)
- [x] `originParityCheck` crawler that diffs two hosts (Pages vs. origin)
- [ ] Per-project adoption: header/redirect table tests, parity runs against `next.*` hosts

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
