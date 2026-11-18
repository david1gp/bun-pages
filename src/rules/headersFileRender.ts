import type { HttpHeaderRule } from "./HttpHeaderRule.js"

/** Renders header rules in Pages `_headers` format: one path line, then two-space-indented `Name: value` lines. */
export function headersFileRender(rules: readonly HttpHeaderRule[]): string {
  return `${rules
    .map(
      (rule) =>
        `${rule.path}\n${Object.entries(rule.headers)
          .map(([name, value]) => `  ${name}: ${value}`)
          .join("\n")}`,
    )
    .join("\n")}\n`
}
