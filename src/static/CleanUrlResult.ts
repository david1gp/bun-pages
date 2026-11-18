/** Outcome of the clean-URL rewrite for one request pathname. */
export type CleanUrlResult =
  | { readonly kind: "serve"; readonly fileSubpath: string }
  | { readonly kind: "redirect"; readonly location: string }
  | { readonly kind: "none" }
