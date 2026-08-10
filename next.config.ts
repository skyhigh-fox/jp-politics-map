import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 公開データ（/data 配下の静的JSON）をブラウザの JavaScript からも
   * 取得できるようにする（機能拡充ロードマップ Tier1 #9）。
   * 静的エクスポート（output: "export"）でホスティングする場合はこの設定が
   * 無視されるため、その際はホスティング側でCORSヘッダーを付与する。
   */
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
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
