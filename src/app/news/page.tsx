import { getNews } from "@/lib/news";

export default async function NewsPage() {
  const news = await getNews();
  const sorted = [...news].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        最新ニュース
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {news.length === 0 ? (
          <>
            データ未取得です。
            <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              npm run fetch:news
            </code>
            で取得してください。
          </>
        ) : (
          `総務省「ホームページ新着情報」の見出し ${news.length}件（新しい順、選挙関連の告知等を含む総務省全般のお知らせ）`
        )}
      </p>

      {news.length > 0 && (
        <ul className="mt-6 flex max-w-2xl flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {sorted.map((item) => (
            <li key={item.id} className="py-3">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-neutral-900 transition-colors hover:text-accent-600 hover:underline dark:text-neutral-100 dark:hover:text-accent-400"
              >
                {item.title}
              </a>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                {item.sourceName} ・ {item.publishedAt.slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 max-w-2xl text-xs text-neutral-400 dark:text-neutral-600">
        見出し・リンクのみを総務省「ホームページ新着情報」RSSより取得して表示しています。本文・画像は転載していません。記事の全文は各リンク先でご覧ください。
      </p>
    </div>
  );
}
