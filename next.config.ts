import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  // Lets a production build run beside a live dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default config;
