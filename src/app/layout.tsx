import type { Metadata } from "next";
import Link from "next/link";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { NewsMenu } from "@/components/NewsMenu";
import { MobileNav } from "@/components/MobileNav";
import { getNews } from "@/lib/news";
import "./globals.css";

export const metadata: Metadata = {
  title: "日本政治マップ",
  description:
    "日本地図をベースに、都道府県・市区町村ごとの政治情報（法案審議進捗、議員リスト、選挙結果）を閲覧できるサイト",
};

const NAV_LINKS = [
  { href: "/bills", label: "法案一覧" },
  { href: "/legislators", label: "議員一覧" },
  { href: "/map", label: "都道府県マップ" },
] as const;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const news = await getNews();

  return (
    <html lang="ja">
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
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
        <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
        <ScrollToTopButton />
      </body>
    </html>
  );
}
