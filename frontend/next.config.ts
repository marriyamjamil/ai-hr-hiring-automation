import type { NextConfig } from "next";

// The backend's host name, e.g. "arcadia-hireai-api-xxxx.azurewebsites.net" (from the build variable)
const apiHost = (process.env.NEXT_PUBLIC_API_URL ?? "")
  .trim()
  .replace(/^https?:\/\//, "")
  .replace(/\/.*$/, "");

const nextConfig: NextConfig = {
  // Safety net for Azure: an older saved copy of the login page called the backend WITHOUT
  // "https://", so the browser sent it to "/<backend-host>/api/..." on this website.
  // Forward those requests to the real backend, so even that old copy logs in correctly.
  async rewrites() {
    if (!apiHost) return [];
    return {
      beforeFiles: [{ source: `/${apiHost}/:path*`, destination: `https://${apiHost}/:path*` }],
      afterFiles: [],
      fallback: [],
    };
  },
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
