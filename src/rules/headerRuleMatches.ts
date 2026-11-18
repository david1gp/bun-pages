const regExpSpecial = /[.+?^${}()|[\]\\]/g

/** Matches a Pages-style path pattern against a request pathname: exact, or `*` matching any run of characters. */
export function headerRuleMatches(pattern: string, pathname: string): boolean {
  if (!pattern.includes("*")) return pattern === pathname
  const source = pattern
    .split("*")
    .map((part) => part.replace(regExpSpecial, "\\$&"))
    .join(".*")
  return new RegExp(`^${source}$`).test(pathname)
}
