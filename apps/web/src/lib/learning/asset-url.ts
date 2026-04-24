import { r2PublicUrl } from "@/lib/r2/client";

/** Learning/interview content still stores site-relative paths like "/learning/os-book/figures/x.jpg" or
 *  "/war-room/coding-card.svg" (unchanged, so existing dimension-lookup tables like os-figure-dimensions.json
 *  keyed by that same relative path stay valid) - this resolves them to the R2 public URL at render time. */
export function learningAssetUrl(relativePath: string): string {
  if (!relativePath) return relativePath;
  if (/^https?:\/\//i.test(relativePath)) return relativePath; // already absolute, leave alone
  return r2PublicUrl(relativePath.replace(/^\/+/, ""));
}
