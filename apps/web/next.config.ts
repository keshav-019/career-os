import type { NextConfig } from "next";
import path from "node:path";

const appDir = process.cwd();
const repoRoot = path.resolve(appDir, "../..");

const nextConfig: NextConfig = {
  output: process.env.CAREEROS_DESKTOP_BUILD === "1" ? "standalone" : undefined,
  // firebase-admin (and its transitive grpc/protobuf dependencies) breaks when Next's production bundler tries to
  // webpack-bundle it into the serverless function - it needs to stay a plain Node require instead. This only
  // shows up in an actual Vercel/production build, not `next dev`, which is why routes touching lib/firebase/admin.ts
  // (system-design, coding-problems, admin/*, interview/templates) can crash with a generic 500 in production while
  // working fine locally.
  serverExternalPackages: ["firebase-admin"],
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
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "pub-33382a89004f4a9f9dc850cbcac5fedd.r2.dev" }]
  }
};

export default nextConfig;
