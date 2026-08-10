"use client";

import Link from "next/link";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { PartyColorDot } from "@/components/PartyColorDot";
import type { Legislator, Party } from "@/types";

const PAGE_SIZE = 60;

/**
 * 議員一覧グリッド。一番下までスクロールすると自動で表示件数を追加する
 * （`src/components/InfiniteBillsTable.tsx`＝法案一覧と同じ設計。
 * IntersectionObserverで下端の目印要素を監視し、見えたら表示件数を増やす）。
 * フィルタ後の全件をあらかじめサーバー側から受け取っておき、
 * クライアント側では表示件数を絞るだけ（追加のネットワークリクエストは発生しない）。
 */
export function InfiniteLegislatorList({
  legislators,
  parties,
}: {
  legislators: Legislator[];
  parties: Party[];
}) {
  const { visibleCount, sentinelRef, shown } = useInfiniteScroll(
    legislators,
    PAGE_SIZE
  );
  const partyById = (id: string) => parties.find((p) => p.id === id);

  return (
    <>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {shown.map((legislator) => {
          const party = partyById(legislator.currentPartyId);
          return (
            <li key={legislator.id}>
              <Link
                href={`/legislators/${legislator.id}`}
                className="group block rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-card transition-all hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-card-hover dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-accent-700"
              >
                <div className="font-semibold text-neutral-900 group-hover:text-accent-600 dark:text-neutral-100 dark:group-hover:text-accent-400">
                  {legislator.name}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                  <PartyColorDot color={party?.color} />
                  <span>
                    {legislator.chamber} / {party?.name ?? "不明"}
                  </span>
                </div>
                <div className="text-neutral-600 dark:text-neutral-400">
                  {legislator.district}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* 読み込みトリガー用の目印。見た目には何も表示しない（進捗表示は下の固定バー側） */}
      <div ref={sentinelRef} className="h-px" aria-hidden />
      <div className="h-16" />

      {/* スクロールに合わせて自動読み込みされると、進捗を示すだけの要素が
          常に画面外に流れてしまい読めないため、画面下部に固定して常に見えるようにする */}
      {legislators.length > PAGE_SIZE && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/95 px-6 py-2 text-center text-xs text-neutral-600 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 dark:text-neutral-400">
          {visibleCount < legislators.length
            ? `${visibleCount} / ${legislators.length} 名を表示中…スクロールで続きを読み込みます`
            : `全${legislators.length}名を表示しました`}
        </div>
      )}
    </>
  );
}
