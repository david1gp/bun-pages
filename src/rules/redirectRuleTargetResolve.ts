import type { HttpRedirectRule } from "./HttpRedirectRule.js"

/** Resolves a redirect rule for a request host/pathname to its target (`:splat` substituted), or `null` on no match. Query strings are left to the caller. */
export function redirectRuleTargetResolve(rule: HttpRedirectRule, hostname: string, pathname: string): string | null {
  if (rule.host !== undefined && rule.host.toLowerCase() !== hostname.toLowerCase()) return null
  if (rule.from.endsWith("/*")) {
    const base = rule.from.slice(0, -2)
    if (!pathname.startsWith(`${base}/`)) return null
    return rule.to.replaceAll(":splat", pathname.slice(base.length + 1))
  }
  if (pathname === rule.from) return rule.to.replaceAll(":splat", "")
  const star = rule.from.indexOf("*")
  if (star === -1 || rule.from.indexOf("*", star + 1) !== -1) return null
  const prefix = rule.from.slice(0, star)
  const suffix = rule.from.slice(star + 1)
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null
  const splat = pathname.slice(prefix.length, pathname.length - suffix.length)
  if (!splat) return null
  const target = rule.to.replaceAll(":splat", splat)
  // A path-based catch-all must not turn a double slash into an external Location.
  if (rule.to.startsWith("/") && !rule.to.startsWith("//") && target.startsWith("//")) return null
  return target
}
