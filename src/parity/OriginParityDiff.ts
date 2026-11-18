export type OriginParityDiff = {
  /** Requested path (with query string) whose responses differed. */
  readonly path: string
  /** What differed: `status`, `location`, `header:<name>` or `body-sha256`. */
  readonly field: string
  readonly a: string
  readonly b: string
}
