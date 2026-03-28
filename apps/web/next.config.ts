import type { NextConfig } from "next";
import path from "node:path";

const appDir = process.cwd();
const repoRoot = path.resolve(appDir, "../..");

const nextConfig: NextConfig = {
  output: process.env.CAREEROS_DESKTOP_BUILD === "1" ? "standalone" : undefined,
  outputFileTracingRoot: repoRoot,
  outputFileTracingExcludes: {
    "/api/learning/admin/session": ["./public/**/*"],
    "/api/learning/library": ["./public/**/*"],
    "/api/learning/topic": ["./public/**/*"]
  },
  outputFileTracingIncludes: {
    "/api/extension/download": ["../extension/**/*"],
    "/api/resume/extract": ["../../node_modules/pdfjs-dist/**/*"]
  },
  transpilePackages: ["@careeros/shared"],
  turbopack: {
    root: repoRoot
  }
};

export default nextConfig;
