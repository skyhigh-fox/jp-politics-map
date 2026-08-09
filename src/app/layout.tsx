import type { Metadata } from "next";
import Link from "next/link";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { NewsMenu } from "@/components/NewsMenu";
import { getNews } from "@/lib/news";
import "./globals.css";

export const metadata: Metadata = {
  title: "日本政治マップ",
  description:
    "日本地図をベースに、都道府県・市区町村ごとの政治情報（法案審議進捗、議員リスト、選挙結果）を閲覧できるサイト",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const news = await getNews();

  return (
    <html lang="ja">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <header className="border-b border-neutral-200 px-6 py-4">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/" className="font-semibold">
              日本政治マップ
            </Link>
            <Link href="/bills" className="text-neutral-600 hover:text-neutral-900">
              法案一覧
            </Link>
            <Link
              href="/legislators"
              className="text-neutral-600 hover:text-neutral-900"
            >
              議員一覧
            </Link>
            <Link href="/map" className="text-neutral-600 hover:text-neutral-900">
              地図
            </Link>
            <NewsMenu items={news} />
          </nav>
        </header>
        <main className="px-6 py-8">{children}</main>
        <ScrollToTopButton />
      </body>
    </html>
  );
}
