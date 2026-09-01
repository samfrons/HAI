import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The playbooks and guides routes read markdown from `../content`, which
  // sits outside this Next.js project root (`app/`). Output file tracing
  // include/exclude globs may not navigate outside the project root with
  // `../`, so the tracing root is widened to the repo root and the include
  // globs are written relative to that instead.
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/playbooks": ["content/**/*"],
    "/playbooks/*": ["content/**/*"],
    "/guides": ["content/**/*"],
    "/guides/*": ["content/**/*"],
  },
};

export default nextConfig;
