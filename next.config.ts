import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  // Lets a production build run beside a live dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Every project URL is served from one prerendered, cached shell (src/app/p/[id]/layout.tsx).
  async rewrites() {
    return {
      beforeFiles: [{ source: "/p/:id/:page(generate|intake|studio)", destination: "/p/_/:page" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default config;
