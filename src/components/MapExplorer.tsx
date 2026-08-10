"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PrefectureMap } from "@/components/PrefectureMap";
import { PrefecturePartyComposition } from "@/components/PrefecturePartyComposition";
import { formatYenCompact } from "@/lib/formatFinance";
import type { Party } from "@/types";

type Layer = "legislators" | "finance";

/**
 * `/map` ページ本体。左に都道府県地図、右にサイドバー
 * （議員数ランキング表＋選択中都道府県の政党別内訳）を並べる2カラムレイアウト。
 *
 * - デスクトップ（lg以上）は「左: 地図／右: サイドバー」の横並び、
 *   モバイルは縦積み（サイドバーが地図の下に来る）。
 * - サイドバーの議員数ランキング表は、地図が読めない・使えないユーザー向けの
 *   アクセシビリティ代替として常設する（地図と同じ情報をテキストでも取得できる）。
 *   ランキングの各行はボタンになっており、地図のクリックと同じ「選択」操作を
 *   キーボード・スクリーンリーダーからも行える。
 * - 都道府県クリック（またはランキング行選択）は、即座に議員一覧へは遷移せず、
 *   まずサイドバーにその都道府県の政党別議席構成を表示する2段階導線
 *   （PrefectureMapのonSelectPrefectureコールバックで受け取る）。
 *   一覧ページへはPrefecturePartyComposition内のリンクから遷移する。
 * - 地図の指標レイヤーは「関連議員数」「歳出総額（都道府県財政、Phase 4）」の
 *   2種類を切り替えられる（financeCountsが取得できている場合のみ表示）。
 *   どちらのレイヤーでも配色ロジック（colorForCount）・サイドバーのランキング表は
 *   共通のまま、指標値と表示形式だけが切り替わる。
 */
export function MapExplorer({
  counts,
  partyCountsByPrefecture,
  parties,
  financeCounts,
  financeFiscalYear,
}: {
  counts: Record<string, number>;
  partyCountsByPrefecture: Record<string, Record<string, number>>;
  parties: Party[];
  /** 都道府県別 歳出総額（千円単位）。未取得時はundefinedまたは空オブジェクト */
  financeCounts?: Record<string, number>;
  financeFiscalYear?: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer>("legislators");

  const hasFinanceLayer = !!financeCounts && Object.keys(financeCounts).length > 0;
  const activeLayer: Layer = hasFinanceLayer ? layer : "legislators";

  const activeCounts = activeLayer === "finance" ? financeCounts! : counts;
  const metricLabel = activeLayer === "finance" ? "歳出総額" : "関連議員";
  const formatValue = useMemo(
    () =>
      activeLayer === "finance"
        ? formatYenCompact
        : (v: number) => `${v}名`,
    [activeLayer]
  );
  const ranking = Object.entries(activeCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        {hasFinanceLayer && (
          <div
            role="group"
            aria-label="地図に表示する指標の切り替え"
            className="mb-3 inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 text-xs dark:border-neutral-800 dark:bg-neutral-900"
          >
            <button
              type="button"
              onClick={() => setLayer("legislators")}
              aria-pressed={activeLayer === "legislators"}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                activeLayer === "legislators"
                  ? "bg-accent-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`}
            >
              関連議員数
            </button>
            <button
              type="button"
              onClick={() => setLayer("finance")}
              aria-pressed={activeLayer === "finance"}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                activeLayer === "finance"
                  ? "bg-accent-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`}
            >
              歳出総額{financeFiscalYear ? `（${financeFiscalYear}年度）` : ""}
            </button>
          </div>
        )}
        {activeLayer === "finance" && (
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-500">
            都道府県普通会計の決算額（総務省「地方財政状況調査」）。人口規模の違いをそのまま反映するため、都市部ほど大きくなる傾向がある点に留意してください。
          </p>
        )}
        <PrefectureMap
          counts={activeCounts}
          selected={selected}
          onSelectPrefecture={setSelected}
          metricLabel={metricLabel}
          formatValue={formatValue}
        />
      </div>

      <aside className="flex flex-col gap-4">
        {selected ? (
          <PrefecturePartyComposition
            prefecture={selected}
            partyCounts={partyCountsByPrefecture[selected] ?? {}}
            parties={parties}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-xs leading-relaxed text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500">
            地図上の都道府県をクリックする（または下のランキング表から選ぶ）と、
            その都道府県の政党別議席構成がここに表示されます。
          </div>
        )}

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            都道府県別 {metricLabel}ランキング
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            多い順・全{ranking.length}都道府県。地図と同じ情報をテキストで確認できます。
          </p>
          <ol className="mt-3 max-h-96 space-y-0.5 overflow-y-auto">
            {ranking.map(([name, count], i) => {
              const isSelected = name === selected;
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => setSelected(name)}
                    aria-pressed={isSelected}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-300"
                        : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span className="w-5 shrink-0 text-right tabular-nums text-neutral-400 dark:text-neutral-500">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate">{name}</span>
                    <span className="shrink-0 tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
                      {formatValue(count)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {selected && (
            <Link
              href={`/map/${encodeURIComponent(selected)}`}
              className="mt-3 inline-flex items-center text-xs font-medium text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
            >
              選択中（{selected}）の詳細（市区町村マップ・議員一覧）を見る
              <span aria-hidden className="ml-1">
                →
              </span>
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}
