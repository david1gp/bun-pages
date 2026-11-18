import { headerRuleMatches } from "../rules/headerRuleMatches.js"

/** Reports whether a pathname is served from static files before SSR (same `*` syntax as header rules). */
export function staticFirstMatches(patterns: readonly string[], pathname: string): boolean {
  return patterns.some((pattern) => headerRuleMatches(pattern, pathname))
}
