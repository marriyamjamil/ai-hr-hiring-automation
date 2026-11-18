import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // For Azure: the build makes a small ready-to-run folder (.next/standalone) with its own server.js
  output: "standalone",
  cacheComponents: true,
  // Allow photos from Unsplash (free stock photos) in <Image>
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
