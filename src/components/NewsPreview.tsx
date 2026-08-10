import Link from "next/link";
import type { NewsItem } from "@/lib/news";

const PREVIEW_COUNT = 3;

/**
 * トップページ用「最新ニュース」プレビュー。
 * ヘッダーのNewsMenu.tsx（クリック開閉式ミニ一覧）とは役割が異なり、
 * こちらはページ内に常時表示する簡素なカード（クライアント側の開閉状態を
 * 持たないサーバーコンポーネント）。
 */
export function NewsPreview({ items }: { items: NewsItem[] }) {
  const sorted = [...items].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
  const preview = sorted.slice(0, PREVIEW_COUNT);

  return (
    <div className="flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        最新ニュース
      </h2>

      {preview.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
          データ未取得です。
          <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            npm run fetch:news
          </code>
          で取得してください。
        </p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
          {preview.map((item) => (
            <li key={item.id} className="py-2.5 first:pt-0">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-medium leading-snug text-neutral-800 transition-colors hover:text-accent-600 hover:underline dark:text-neutral-200 dark:hover:text-accent-400"
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

      <Link
        href="/news"
        className="mt-4 inline-flex items-center text-xs font-medium text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
      >
        すべてのニュースを見る
        <span aria-hidden className="ml-1">
          →
        </span>
      </Link>
    </div>
  );
}
