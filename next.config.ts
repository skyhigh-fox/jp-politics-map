import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 議員写真はWikimedia Commons等の外部ホストから配信する想定
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
};

export default nextConfig;
