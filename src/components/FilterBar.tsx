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
    <div className="mt-4 flex flex-wrap items-end gap-3">
      {selects.map((select) => (
        <label key={select.key} className="text-xs text-neutral-600">
          <div className="mb-1">{select.label}</div>
          <select
            className="rounded border border-neutral-300 px-2 py-1 text-sm"
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
          className="text-xs text-neutral-600"
          onSubmit={(e) => {
            e.preventDefault();
            updateParam(searchKey, searchValue);
          }}
        >
          <div className="mb-1">{searchLabel ?? "キーワード"}</div>
          <input
            type="search"
            className="rounded border border-neutral-300 px-2 py-1 text-sm"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </form>
      )}

      {hasActiveFilter && (
        <button
          type="button"
          className="text-xs text-neutral-500 underline"
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
        <span className="text-xs text-neutral-400">更新中…</span>
      )}
    </div>
  );
}
