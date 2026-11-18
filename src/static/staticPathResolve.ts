import { relative, resolve, sep } from "node:path"

/** Resolves a request subpath to a file under `clientRoot`, or `null` when it is invalid or would escape (percent-encoded `..` included). */
export function staticPathResolve(clientRoot: string, subpath: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(subpath)
  } catch {
    return null
  }
  const path = resolve(clientRoot, `.${decoded}`)
  const relativePath = relative(clientRoot, path)
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) return null
  return path
}
