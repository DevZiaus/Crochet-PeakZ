import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Applies the security-relevant upgrade guidance for this app.
    agentUpgrade: "security",
  },
  // Emit a self-contained server bundle so the app can run on any Node.js
  // host or container, not only on Vercel.
  output: "standalone",
  // The workspace root contains the lockfile and shared package, so trace
  // files from the repository root rather than apps/web.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  poweredByHeader: false,
  transpilePackages: ["@crochet-peakz/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
