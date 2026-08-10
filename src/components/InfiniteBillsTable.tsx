"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Bill } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { classifyBillTopics } from "@/lib/billTopics";

const PAGE_SIZE = 50;

/**
 * 法案一覧テーブル。一番下までスクロールすると自動で表示件数を追加する
 * （IntersectionObserverで下端の目印要素を監視し、見えたら表示件数を増やす）。
 * フィルタ後の全件をあらかじめサーバー側から受け取っておき、
 * クライアント側では表示件数を絞るだけ（追加のネットワークリクエストは発生しない）。
 */
export function InfiniteBillsTable({ bills }: { bills: Bill[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // フィルタ条件が変わって`bills`が入れ替わったら表示件数をリセットする
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [bills]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, bills.length));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [bills.length]);

  const shown = bills.slice(0, visibleCount);

  return (
    <>
      <div className="mt-6 overflow-hidden overflow-x-auto rounded-xl border border-neutral-200 shadow-card dark:border-neutral-800">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left dark:border-neutral-800 dark:bg-neutral-900">
              <th className="px-4 py-2.5 pr-4 font-medium text-neutral-600 dark:text-neutral-400">
                国会回次
              </th>
              <th className="px-4 py-2.5 pr-4 font-medium text-neutral-600 dark:text-neutral-400">
                件名
              </th>
              <th className="px-4 py-2.5 pr-4 font-medium text-neutral-600 dark:text-neutral-400">
                提出
              </th>
              <th className="px-4 py-2.5 pr-4 font-medium text-neutral-600 dark:text-neutral-400">
                院
              </th>
              <th className="px-4 py-2.5 pr-4 font-medium text-neutral-600 dark:text-neutral-400">
                状況
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-neutral-900">
            {shown.map((bill) => (
              <tr
                key={bill.id}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
              >
                <td className="px-4 py-2.5 pr-4 text-neutral-700 dark:text-neutral-300">
                  {bill.dietSession}
                </td>
                <td className="px-4 py-2.5 pr-4">
                  <Link
                    href={`/bills/${bill.id}`}
                    className="text-accent-600 transition-colors hover:text-accent-700 hover:underline dark:text-accent-400 dark:hover:text-accent-300"
                  >
                    {bill.title}
                  </Link>
                  {classifyBillTopics(bill.title).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {classifyBillTopics(bill.title).map((topic) => (
                        <span
                          key={topic}
                          className="inline-block rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 pr-4 text-neutral-700 dark:text-neutral-300">
                  {bill.submitterType}
                </td>
                <td className="px-4 py-2.5 pr-4 text-neutral-700 dark:text-neutral-300">
                  {bill.house}
                </td>
                <td className="px-4 py-2.5 pr-4">
                  <StatusBadge status={bill.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 読み込みトリガー用の目印。見た目には何も表示しない（進捗表示は下の固定バー側） */}
      <div ref={sentinelRef} className="h-px" aria-hidden />
      <div className="h-16" />

      {/* スクロールに合わせて自動読み込みされると、進捗を示すだけの要素が
          常に画面外に流れてしまい読めないため、画面下部に固定して常に見えるようにする */}
      {bills.length > PAGE_SIZE && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/95 px-6 py-2 text-center text-xs text-neutral-600 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 dark:text-neutral-400">
          {visibleCount < bills.length
            ? `${visibleCount} / ${bills.length} 件を表示中…スクロールで続きを読み込みます`
            : `全${bills.length}件を表示しました`}
        </div>
      )}
    </>
  );
}
