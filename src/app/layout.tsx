import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { NewsMenu } from "@/components/NewsMenu";
import { MobileNav } from "@/components/MobileNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getNews } from "@/lib/news";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/siteMetadata";
import "./globals.css";

/**
 * サイト全体のメタデータ既定値。
 *
 * - `metadataBase`: 各ページが相対パスでcanonical・og:urlを書けるようにするための基準URL。
 *   本番ドメインが未確定のため、環境変数から解決している（詳細は src/lib/siteMetadata.ts）。
 * - `title.template`: 各ページは`title`にページ名だけを書けばよく、サイト名は自動で付く。
 *   個別ページで`| 日本政治マップ`を手書きしないこと（二重に付く）。
 * - OGP画像は現時点では用意していない。日本語を描画できるフォントを同梱する必要があり、
 *   リポジトリサイズとのトレードオフになるため、画像なし（テキストのみのカード）で公開する。
 *   用意する場合は public/ に1枚置いて `openGraph.images` に追加すれば全ページに効く。
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ja_JP",
    url: "/",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

const NAV_LINKS = [
  { href: "/bills", label: "法案一覧" },
  { href: "/legislators", label: "議員一覧" },
  { href: "/votes", label: "記名投票" },
  { href: "/map", label: "都道府県マップ" },
  { href: "/map/districts", label: "選挙区マップ" },
  { href: "/budget", label: "国の予算・決算" },
] as const;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const news = await getNews();

  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/80 dark:supports-[backdrop-filter]:bg-neutral-950/70">
          <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 text-sm sm:justify-start sm:px-6">
            <Link
              href="/"
              className="font-semibold tracking-tight text-neutral-900 transition-colors hover:text-accent-600 dark:text-neutral-50 dark:hover:text-accent-400"
            >
              日本政治マップ
            </Link>
            <div className="hidden items-center gap-5 sm:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-neutral-600 transition-colors hover:text-accent-600 dark:text-neutral-400 dark:hover:text-accent-400"
                >
                  {link.label}
                </Link>
              ))}
              <NewsMenu items={news} />
            </div>
            <MobileNav navLinks={NAV_LINKS} news={news} />
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
        <SiteFooter />
        <ScrollToTopButton />
        <Analytics />
      </body>
    </html>
  );
}
