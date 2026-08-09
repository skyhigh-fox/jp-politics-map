import { getNews } from "@/lib/news";

export default async function NewsPage() {
  const news = await getNews();
  const sorted = [...news].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );

  return (
    <div>
      <h1 className="text-xl font-bold">最新ニュース（政治）</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {news.length === 0 ? (
          <>
            データ未取得です。
            <code className="mx-1 rounded bg-neutral-100 px-1">
              npm run fetch:news
            </code>
            で取得してください。
          </>
        ) : (
          `NHK NEWS WEB「政治」カテゴリの見出し ${news.length}件（新しい順）`
        )}
      </p>

      {news.length > 0 && (
        <ul className="mt-6 flex max-w-2xl flex-col divide-y divide-neutral-200">
          {sorted.map((item) => (
            <li key={item.id} className="py-3">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-neutral-900 hover:underline"
              >
                {item.title}
              </a>
              <p className="mt-1 text-xs text-neutral-500">
                {item.sourceName} ・ {item.publishedAt.slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 max-w-2xl text-xs text-neutral-400">
        見出し・リンクのみをNHK NEWS
        WEB「政治」カテゴリRSSより取得して表示しています。本文・画像は転載していません。記事の全文は各リンク先（NHK
        NEWS WEB）でご覧ください。
      </p>
    </div>
  );
}
