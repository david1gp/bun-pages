import type { HttpRedirectRule } from "./HttpRedirectRule.js"

/** Resolves a redirect rule for a request host/pathname to its target (`:splat` substituted), or `null` on no match. Query strings are left to the caller. */
export function redirectRuleTargetResolve(rule: HttpRedirectRule, hostname: string, pathname: string): string | null {
  if (rule.host !== undefined && rule.host.toLowerCase() !== hostname.toLowerCase()) return null
  if (rule.from.endsWith("/*")) {
    const base = rule.from.slice(0, -2)
    if (!pathname.startsWith(`${base}/`)) return null
    return rule.to.replaceAll(":splat", pathname.slice(base.length + 1))
  }
  if (pathname !== rule.from) return null
  return rule.to.replaceAll(":splat", "")
}
