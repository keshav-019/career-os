import type { NextConfig } from "next";
import path from "node:path";

const appDir = process.cwd();
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
