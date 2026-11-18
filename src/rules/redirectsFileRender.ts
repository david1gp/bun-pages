import type { HttpRedirectRule } from "./HttpRedirectRule.js"

/** Renders redirect rules in Pages `_redirects` format: `from  to  status`, one rule per line. Host restrictions cannot be expressed and are dropped. */
export function redirectsFileRender(rules: readonly HttpRedirectRule[]): string {
  return `${rules.map((rule) => `${rule.from}  ${rule.to}  ${rule.status ?? 301}`).join("\n")}\n`
}
