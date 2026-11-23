import type { HttpHeaderRule } from "./HttpHeaderRule.js"
import { headerRuleMatches } from "./headerRuleMatches.js"
import { responseHeadersApply } from "./responseHeadersApply.js"

/** Applies matching rules in order to a response using the original request path. */
export function headerRulesApply(rules: readonly HttpHeaderRule[], pathname: string, response: Response): Response {
  const headers: Record<string, string> = {}
  for (const rule of rules) {
    if (headerRuleMatches(rule.path, pathname)) Object.assign(headers, rule.headers)
  }
  return Object.keys(headers).length > 0 ? responseHeadersApply(response, headers) : response
}
