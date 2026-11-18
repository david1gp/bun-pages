import type { CleanUrlResult } from "./CleanUrlResult.js"

/**
 * Maps a request pathname to a static file or a canonical redirect, Pages-style:
 * `/a` serves `a.html` (or `a/index.html`); `/a.html` 308s to `/a`;
 * `/a/index.html` 308s to `/a/`; `/a/` serves `a/index.html`;
 * `/dir` with only `dir/index.html` 308s to `/dir/`.
 * The caller appends the query string to redirect locations.
 */
export function cleanUrlRewrite(
  pathname: string,
  fileExists: (subpath: string) => boolean | Promise<boolean>,
): Promise<CleanUrlResult> {
  return cleanUrlRewriteRun(pathname, fileExists)
}

async function cleanUrlRewriteRun(
  pathname: string,
  fileExists: (subpath: string) => boolean | Promise<boolean>,
): Promise<CleanUrlResult> {
  if (pathname.endsWith("/index.html")) {
    if (await fileExists(pathname)) return { kind: "redirect", location: pathname.slice(0, -"index.html".length) }
    return { kind: "none" }
  }
  if (pathname.endsWith(".html")) {
    if (await fileExists(pathname)) return { kind: "redirect", location: pathname.slice(0, -".html".length) }
    return { kind: "none" }
  }
  if (pathname.endsWith("/")) {
    if (await fileExists(`${pathname}index.html`)) return { kind: "serve", fileSubpath: `${pathname}index.html` }
    return { kind: "none" }
  }
  if (await fileExists(pathname)) return { kind: "serve", fileSubpath: pathname }
  if (await fileExists(`${pathname}.html`)) return { kind: "serve", fileSubpath: `${pathname}.html` }
  if (await fileExists(`${pathname}/index.html`)) return { kind: "redirect", location: `${pathname}/` }
  return { kind: "none" }
}
