import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/siteMetadata";

/**
 * robots.txt（Next.jsのMetadata Files規約。ビルド時に静的生成される）。
 *
 * 【方針】
 * 公開している情報はすべて公的機関の公表資料に基づく一般公開情報であり、
 * 認証の必要な領域も個人向けの領域も持たないため、全パスをクロール許可する。
 * 配布用JSON（/data/... 配下）も、規約上再配布が認められているものだけを
 * 置いている（判断の根拠は src/lib/datasetDownloads.ts）ので除外しない。
 *
 * sitemapのURLは絶対URLでなければならない（robots.txtの仕様）。
 * 本番ドメインが未確定のため、metadataBaseと同じ環境変数から解決している
 * （詳細は src/lib/siteMetadata.ts）。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
