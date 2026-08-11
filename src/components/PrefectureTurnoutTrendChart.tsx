"use client";

import { useId, useMemo, useState } from "react";
import { DataInsight } from "@/components/DataInsight";
import {
  formatTurnoutDiff,
  formatTurnoutValue,
  turnoutGenderMeta,
  type TurnoutGenderKey,
  type TurnoutTrendSeries,
} from "@/lib/turnoutStats";

/**
 * 【投票率の推移グラフ（機能拡充ロードマップ Tier1 #7）】
 * 素のSVGで組んだ折れ線グラフ。院（衆議院／参議院）ごとに1枚ずつ描く。
 *
 * フォーム選定: 投票率は「率」であり積み上がらない量なので、
 * PartySeatTrendChart（議席数＝積み上げ棒）とは異なり折れ線を採用した。
 * ただし衆議院（小選挙区）と参議院（選挙区）は仕組みも実施間隔も違うため、
 * 1本の線につなげず院ごとに独立したグラフに分けている。
 * 横軸は選挙を等間隔に並べた離散軸（実際の年月の間隔は不均一）である旨を
 * 説明文に明記している。
 *
 * 縦軸: 常に 0〜100% の全域を取る。投票率のようなパーセンテージで
 * 軸を切り詰める（例: 40〜70%）と差が実際より大きく見え、
 * 「この都道府県は極端だ」という印象を与えかねないため、
 * 中立性の観点から意図的に全域表示にしている。
 *
 * 配色: dataviz skill の reference palette のカテゴリカル・スロット1（blue）と
 * スロット2（orange）を、既存の src/lib/budgetChartColors.ts と同じ値で使う。
 * 色は「全国計」「選択中の都道府県」という**系列そのもの**に固定で割り当てており、
 * 値の大小では入れ替えない。
 * 検証: dataviz skill の `scripts/validate_palette.js` を、このプロジェクトの
 * 実際のカード面（light `#ffffff` / dark `#171717`）に対して `--pairs all` で
 * 実行し、light/dark とも全チェック PASS（2026-08-11）。
 */

interface Props {
  series: TurnoutTrendSeries[];
  gender: TurnoutGenderKey;
  selectedPrefecture: string | null;
  facts: string[];
}

const VIEW_W = 720;
const VIEW_H = 250;
const MARGIN = { top: 14, right: 12, bottom: 30, left: 38 };
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;
const Y_TICKS = [0, 20, 40, 60, 80, 100];

/** 系列の識別色（light/dark）。系列そのものに固定で割り当てる */
const SERIES_COLORS = {
  national: { light: "#2a78d6", dark: "#3987e5" },
  prefecture: { light: "#eb6834", dark: "#d95926" },
} as const;

function yAt(value: number): number {
  return MARGIN.top + PLOT_H - (value / 100) * PLOT_H;
}

function ChamberChart({
  series,
  gender,
  selectedPrefecture,
}: {
  series: TurnoutTrendSeries;
  gender: TurnoutGenderKey;
  selectedPrefecture: string | null;
}) {
  const titleId = useId();
  const descId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const meta = turnoutGenderMeta(gender);

  const { points } = series;
  const n = points.length;

  const hasPrefectureSeries =
    selectedPrefecture !== null && points.some((p) => p.prefecture !== null);

  const layout = useMemo(() => {
    const slot = n > 1 ? PLOT_W / (n - 1) : 0;
    const xAt = (i: number) =>
      n > 1 ? MARGIN.left + slot * i : MARGIN.left + PLOT_W / 2;
    const nationalPath = points
      .map((p, i) => (p.national === null ? null : `${xAt(i)},${yAt(p.national)}`))
      .filter((s): s is string => s !== null)
      .join(" ");
    const prefecturePath = points
      .map((p, i) => (p.prefecture === null ? null : `${xAt(i)},${yAt(p.prefecture)}`))
      .filter((s): s is string => s !== null)
      .join(" ");
    return { xAt, nationalPath, prefecturePath, hitWidth: n > 1 ? PLOT_W / n : PLOT_W };
  }, [points, n]);

  const { xAt, nationalPath, prefecturePath, hitWidth } = layout;
  const active = activeIndex !== null ? points[activeIndex] : null;
  const activeLeftPct = activeIndex !== null ? (xAt(activeIndex) / VIEW_W) * 100 : null;
  const tooltipAlign =
    activeLeftPct === null
      ? "center"
      : activeLeftPct < 20
        ? "start"
        : activeLeftPct > 80
          ? "end"
          : "center";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4
          id={titleId}
          className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
        >
          {series.chamber}（{series.votingCategory}）
        </h4>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {points[0]?.year}年〜{points[n - 1]?.year}年・{n}回
        </p>
      </div>
      <p id={descId} className="sr-only">
        {series.chamber}の{series.votingCategory}における{meta.phrase}
        の推移。横軸は選挙を実施順に等間隔で並べたもので、実際の実施間隔は均一ではありません。縦軸は0%から100%です。
      </p>

      <div className="relative mt-1.5">
        {active && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max max-w-[calc(100%-8px)] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-card-hover dark:border-neutral-700 dark:bg-neutral-800"
            style={{
              left: `${activeLeftPct}%`,
              transform:
                tooltipAlign === "start"
                  ? "translateX(0%)"
                  : tooltipAlign === "end"
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
            role="status"
          >
            <p className="font-semibold text-neutral-900 dark:text-neutral-50">
              {active.electionName}（{active.electionDate}）
            </p>
            <dl className="mt-1 space-y-0.5">
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                  <span className="turnout-dot turnout-dot-national" />
                  全国計
                </dt>
                <dd className="tabular-nums font-medium text-neutral-900 dark:text-neutral-50">
                  {active.national === null ? "—" : formatTurnoutValue(active.national)}
                </dd>
              </div>
              {hasPrefectureSeries && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                    <span className="turnout-dot turnout-dot-prefecture" />
                    {selectedPrefecture}
                  </dt>
                  <dd className="tabular-nums font-medium text-neutral-900 dark:text-neutral-50">
                    {active.prefecture === null
                      ? "—"
                      : formatTurnoutValue(active.prefecture)}
                  </dd>
                </div>
              )}
              {hasPrefectureSeries &&
                active.national !== null &&
                active.prefecture !== null && (
                  <div className="mt-1 flex items-center justify-between gap-4 border-t border-neutral-200 pt-1 dark:border-neutral-700">
                    <dt className="text-neutral-600 dark:text-neutral-300">差</dt>
                    <dd className="tabular-nums font-medium text-neutral-900 dark:text-neutral-50">
                      {formatTurnoutDiff(active.prefecture - active.national)}
                    </dd>
                  </div>
                )}
            </dl>
          </div>
        )}

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full"
          role="group"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          {Y_TICKS.map((tick) => (
            <line
              key={tick}
              x1={MARGIN.left}
              x2={MARGIN.left + PLOT_W}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
          ))}

          {activeIndex !== null && (
            <line
              x1={xAt(activeIndex)}
              x2={xAt(activeIndex)}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_H}
              stroke="var(--chart-axis)"
              strokeWidth={1}
            />
          )}

          <polyline
            points={nationalPath}
            fill="none"
            stroke="var(--series-national)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {hasPrefectureSeries && (
            <polyline
              points={prefecturePath}
              fill="none"
              stroke="var(--series-prefecture)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {points.map((p, i) =>
            p.national === null ? null : (
              <circle
                key={`n-${p.electionId}`}
                cx={xAt(i)}
                cy={yAt(p.national)}
                r={activeIndex === i ? 5.5 : 4}
                fill="var(--series-national)"
                stroke="var(--chart-surface)"
                strokeWidth={2}
              />
            )
          )}
          {hasPrefectureSeries &&
            points.map((p, i) =>
              p.prefecture === null ? null : (
                <circle
                  key={`p-${p.electionId}`}
                  cx={xAt(i)}
                  cy={yAt(p.prefecture)}
                  r={activeIndex === i ? 5.5 : 4}
                  fill="var(--series-prefecture)"
                  stroke="var(--chart-surface)"
                  strokeWidth={2}
                />
              )
            )}

          <line
            x1={MARGIN.left}
            x2={MARGIN.left + PLOT_W}
            y1={MARGIN.top + PLOT_H}
            y2={MARGIN.top + PLOT_H}
            stroke="var(--chart-axis)"
            strokeWidth={1}
          />

          {Y_TICKS.map((tick) => (
            <text
              key={tick}
              x={MARGIN.left - 6}
              y={yAt(tick) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--chart-ink-secondary)"
            >
              {tick}
            </text>
          ))}

          {points.map((p, i) => (
            <text
              key={`x-${p.electionId}`}
              x={xAt(i)}
              y={MARGIN.top + PLOT_H + 18}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize={10}
              fill="var(--chart-ink-secondary)"
            >
              {p.year}
            </text>
          ))}

          {points.map((p, i) => (
            <rect
              key={`hit-${p.electionId}`}
              className="hit-rect"
              x={xAt(i) - hitWidth / 2}
              y={MARGIN.top}
              width={hitWidth}
              height={PLOT_H}
              tabIndex={0}
              role="button"
              aria-label={`${p.electionName}（${p.electionDate}）：全国計${
                p.national === null ? "データなし" : formatTurnoutValue(p.national)
              }${
                hasPrefectureSeries
                  ? `、${selectedPrefecture}${
                      p.prefecture === null
                        ? "データなし"
                        : formatTurnoutValue(p.prefecture)
                    }`
                  : ""
              }`}
              onPointerEnter={() => setActiveIndex(i)}
              onPointerLeave={() => setActiveIndex((cur) => (cur === i ? null : cur))}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex((cur) => (cur === i ? null : cur))}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

export function PrefectureTurnoutTrendChart({
  series,
  gender,
  selectedPrefecture,
  facts,
}: Props) {
  const meta = turnoutGenderMeta(gender);
  const hasPrefectureSeries =
    selectedPrefecture !== null &&
    series.some((s) => s.points.some((p) => p.prefecture !== null));

  if (series.length === 0) return null;

  return (
    <section className="turnout-trend-chart mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <style>{`
        .turnout-trend-chart {
          --chart-surface: #ffffff;
          --chart-ink-secondary: #525252;
          --chart-grid: #e5e5e5;
          --chart-axis: #d4d4d4;
          --series-national: ${SERIES_COLORS.national.light};
          --series-prefecture: ${SERIES_COLORS.prefecture.light};
        }
        @media (prefers-color-scheme: dark) {
          .turnout-trend-chart {
            --chart-surface: #171717;
            --chart-ink-secondary: #a3a3a3;
            --chart-grid: #262626;
            --chart-axis: #404040;
            --series-national: ${SERIES_COLORS.national.dark};
            --series-prefecture: ${SERIES_COLORS.prefecture.dark};
          }
        }
        .turnout-trend-chart .hit-rect { fill: transparent; cursor: pointer; }
        .turnout-trend-chart .hit-rect:focus-visible {
          outline: none;
          stroke: var(--chart-axis);
          stroke-width: 2;
        }
        .turnout-trend-chart .turnout-dot {
          display: inline-block;
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 9999px;
        }
        .turnout-trend-chart .turnout-dot-national { background: var(--series-national); }
        .turnout-trend-chart .turnout-dot-prefecture { background: var(--series-prefecture); }
      `}</style>

      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        投票率の推移（{meta.label.replace("（男女計）", "")}）
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
        総務省の各回選挙結果調に基づく実測値です。横軸は選挙を実施順に等間隔で並べたもので、実際の実施間隔は均一ではありません。縦軸は0〜100%の全域を表示しています。
        {hasPrefectureSeries
          ? `地図で選択中の${selectedPrefecture}と全国計を並べています。`
          : "地図で都道府県を選ぶと、その都道府県の推移が全国計と並べて表示されます。"}
      </p>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        <li className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="turnout-dot turnout-dot-national" />
          全国計
        </li>
        {hasPrefectureSeries && (
          <li className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
            <span className="turnout-dot turnout-dot-prefecture" />
            {selectedPrefecture}
          </li>
        )}
      </ul>

      <DataInsight facts={facts} />

      {/* 院ごとのグラフは縦に積む。横並びにすると1枚あたりの幅が狭くなり、
          軸ラベルと折れ線の変化が読み取りにくくなるため（実機確認済み） */}
      <div className="mt-3 flex flex-col gap-6">
        {series.map((s) => (
          <ChamberChart
            key={s.chamber}
            series={s}
            gender={gender}
            selectedPrefecture={selectedPrefecture}
          />
        ))}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          データを表で見る（選挙ごとの投票率、原資料の値のまま）
        </summary>
        <div className="mt-2 space-y-4">
          {series.map((s) => (
            <div key={s.chamber}>
              <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                {s.chamber}（{s.votingCategory}）
              </p>
              <div className="mt-1 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                <table className="w-full min-w-[360px] border-collapse text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-neutral-600 dark:text-neutral-300">
                        選挙
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium text-neutral-600 dark:text-neutral-300">
                        全国計
                      </th>
                      {hasPrefectureSeries && (
                        <th className="px-3 py-1.5 text-right font-medium text-neutral-600 dark:text-neutral-300">
                          {selectedPrefecture}
                        </th>
                      )}
                      <th className="px-3 py-1.5 text-left font-medium text-neutral-600 dark:text-neutral-300">
                        出典
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.points.map((p) => (
                      <tr
                        key={p.electionId}
                        className="border-t border-neutral-100 dark:border-neutral-800"
                      >
                        <td className="px-3 py-1 text-neutral-700 dark:text-neutral-300">
                          {p.electionName}（{p.electionDate}）
                        </td>
                        <td className="px-3 py-1 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                          {p.national === null ? "—" : formatTurnoutValue(p.national)}
                        </td>
                        {hasPrefectureSeries && (
                          <td className="px-3 py-1 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                            {p.prefecture === null
                              ? "—"
                              : formatTurnoutValue(p.prefecture)}
                          </td>
                        )}
                        <td className="px-3 py-1">
                          <a
                            href={p.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent-600 hover:underline dark:text-accent-400"
                          >
                            Excel
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
