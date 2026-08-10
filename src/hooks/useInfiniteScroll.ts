"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 一覧の「下端までスクロールしたら表示件数を追加する」無限スクロール用フック。
 * IntersectionObserverで下端の目印要素（sentinelRef）を監視し、見えたら
 * 表示件数をpageSizeずつ増やす。フィルタ条件が変わってitemsが入れ替わったら
 * 表示件数を自動でリセットする。
 *
 * `src/components/InfiniteBillsTable.tsx`（法案一覧）で最初に実装したパターンを
 * 議員一覧など他の一覧でも使えるよう切り出したもの。追加のネットワークリクエストは
 * 発生させず、サーバー側から受け取った全件配列をクライアント側で少しずつ見せていく
 * だけの設計を前提とする。
 */
export function useInfiniteScroll<T>(items: T[], pageSize: number) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // フィルタ条件が変わって`items`が入れ替わったら表示件数をリセットする
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + pageSize, items.length));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, pageSize]);

  return {
    visibleCount,
    sentinelRef,
    shown: items.slice(0, visibleCount),
  };
}
