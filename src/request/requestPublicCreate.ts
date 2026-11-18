/** Rebuilds the request on its public `https://<Host>` origin (the tunnel delivers plain http to 127.0.0.1), keeping method, headers and body. */
export function requestPublicCreate(request: Request): Request {
  const host = request.headers.get("host")?.trim()
  if (!host) return request
  const url = new URL(request.url)
  const publicUrl = new URL(`${url.pathname}${url.search}`, `https://${host}`).href
  if (request.method === "GET" || request.method === "HEAD") {
    return new Request(publicUrl, { method: request.method, headers: request.headers, signal: request.signal })
  }
  return new Request(publicUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
    duplex: "half",
  } as RequestInit)
}
