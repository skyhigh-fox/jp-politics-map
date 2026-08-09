import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "日本政治マップ",
  description:
    "日本地図をベースに、都道府県・市区町村ごとの政治情報（法案審議進捗、議員リスト、選挙結果）を閲覧できるサイト",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <header className="border-b border-neutral-200 px-6 py-4">
          <nav className="flex items-center gap-6 text-sm">
            <a href="/" className="font-semibold">
              日本政治マップ
            </a>
            <a href="/bills" className="text-neutral-600 hover:text-neutral-900">
              法案一覧
            </a>
            <a
              href="/legislators"
              className="text-neutral-600 hover:text-neutral-900"
            >
              議員一覧
            </a>
          </nav>
        </header>
        <main className="px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
