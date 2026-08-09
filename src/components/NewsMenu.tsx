"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NewsItem } from "@/lib/news";

const PREVIEW_COUNT = 5;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * ヘッダーの「ニュース」項目をクリックすると開く、最新政治ニュースのミニ一覧。
 * データはlayout.tsx（サーバーコンポーネント）からpropsで受け取る。
 */
export function NewsMenu({ items }: { items: NewsItem[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [open]);

  const preview = items.slice(0, PREVIEW_COUNT);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-neutral-600 transition-colors hover:text-accent-600 dark:text-neutral-400 dark:hover:text-accent-400"
        aria-expanded={open}
        aria-haspopup="true"
      >
        ニュース
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-80 rounded-xl border border-neutral-200 bg-white p-3 shadow-card-hover dark:border-neutral-800 dark:bg-neutral-900">
          {preview.length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-500">
              データ未取得です。
              <code className="mx-1 rounded bg-neutral-100 px-1 dark:bg-neutral-800">
                npm run fetch:news
              </code>
              で取得してください。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {preview.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs leading-snug text-neutral-800 hover:text-accent-600 hover:underline dark:text-neutral-200 dark:hover:text-accent-400"
                  >
                    {item.title}
                    <span className="ml-1 whitespace-nowrap text-neutral-400 dark:text-neutral-500">
                      （{item.sourceName} {formatDate(item.publishedAt)}）
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/news"
            className="mt-3 block text-xs font-medium text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
            onClick={() => setOpen(false)}
          >
            すべてのニュースを見る →
          </Link>
        </div>
      )}
    </div>
  );
}
