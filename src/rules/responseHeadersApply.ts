/** Clones a response with extra headers set, preserving status, status text, body and every `set-cookie` value. */
export function responseHeadersApply(response: Response, headers: Readonly<Record<string, string>>): Response {
  const clone = new Headers()
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie") return
    clone.append(name, value)
  })
  const withGetSetCookie = response.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof withGetSetCookie.getSetCookie === "function") {
    for (const value of withGetSetCookie.getSetCookie()) clone.append("set-cookie", value)
  } else {
    const combined = response.headers.get("set-cookie")
    if (combined !== null) clone.append("set-cookie", combined)
  }
  for (const [name, value] of Object.entries(headers)) clone.set(name, value)
  const body = response.status === 204 || response.status === 205 || response.status === 304 ? null : response.body
  return new Response(body, { status: response.status, statusText: response.statusText, headers: clone })
}
