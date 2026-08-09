"use client";

import { useEffect, useRef, useState } from "react";
import type { Bill } from "@/types";

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
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left">
            <th className="py-2 pr-4">国会回次</th>
            <th className="py-2 pr-4">件名</th>
            <th className="py-2 pr-4">提出</th>
            <th className="py-2 pr-4">院</th>
            <th className="py-2 pr-4">状況</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((bill) => (
            <tr key={bill.id} className="border-b border-neutral-100">
              <td className="py-2 pr-4">{bill.dietSession}</td>
              <td className="py-2 pr-4">
                <a
                  href={bill.sourceUrl}
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {bill.title}
                </a>
              </td>
              <td className="py-2 pr-4">{bill.submitterType}</td>
              <td className="py-2 pr-4">{bill.house}</td>
              <td className="py-2 pr-4">{bill.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div ref={sentinelRef} className="py-6 text-center text-xs text-neutral-400">
        {visibleCount < bills.length
          ? `${visibleCount} / ${bills.length} 件を表示中…スクロールで続きを読み込みます`
          : bills.length > PAGE_SIZE
            ? `全${bills.length}件を表示しました`
            : null}
      </div>
    </>
  );
}
