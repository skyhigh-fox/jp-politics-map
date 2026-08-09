"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

export interface FilterSelect {
  /** URLクエリパラメータのキー */
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * URLクエリパラメータと同期するフィルタUI。
 * セレクトボックス（複数可）＋任意でテキスト検索を持つ。
 * サーバーコンポーネント側は searchParams を読んでデータを絞り込むだけでよい
 * （このコンポーネント自体はデータを持たず、URLを書き換えるだけ）。
 */
export function FilterBar({
  selects,
  searchKey,
  searchLabel,
  searchPlaceholder,
}: {
  selects: FilterSelect[];
  searchKey?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(
    searchKey ? (searchParams.get(searchKey) ?? "") : ""
  );

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const hasActiveFilter =
    selects.some((s) => searchParams.get(s.key)) ||
    (searchKey && searchParams.get(searchKey));

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      {selects.map((select) => (
        <label
          key={select.key}
          className="text-xs text-neutral-600 dark:text-neutral-400"
        >
          <div className="mb-1">{select.label}</div>
          <select
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-800 transition-colors focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            value={searchParams.get(select.key) ?? ""}
            onChange={(e) => updateParam(select.key, e.target.value)}
          >
            <option value="">すべて</option>
            {select.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {searchKey && (
        <form
          className="text-xs text-neutral-600 dark:text-neutral-400"
          onSubmit={(e) => {
            e.preventDefault();
            updateParam(searchKey, searchValue);
          }}
        >
          <div className="mb-1">{searchLabel ?? "キーワード"}</div>
          <input
            type="search"
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-800 transition-colors focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </form>
      )}

      {hasActiveFilter && (
        <button
          type="button"
          className="text-xs text-neutral-500 transition-colors hover:text-accent-600 hover:underline dark:text-neutral-500 dark:hover:text-accent-400"
          onClick={() => {
            setSearchValue("");
            startTransition(() => {
              router.push(pathname);
            });
          }}
        >
          絞り込みを解除
        </button>
      )}
      {isPending && (
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          更新中…
        </span>
      )}
    </div>
  );
}
