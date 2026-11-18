export type HttpHeaderRule = {
  /** Path pattern: exact (`/assets/logo.svg`) or with `*` wildcards (`/assets/*`, `/*.html`) like a Pages `_headers` file. */
  readonly path: string
  readonly headers: Readonly<Record<string, string>>
}
