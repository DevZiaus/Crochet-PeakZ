import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
