import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  outputFileTracingExcludes: {
    "/api/learning/admin/session": ["./public/**/*"],
    "/api/learning/library": ["./public/**/*"],
    "/api/learning/topic": ["./public/**/*"]
  },
  transpilePackages: ["@careeros/shared"],
  turbopack: {
    root: repoRoot
  }
};

export default nextConfig;
