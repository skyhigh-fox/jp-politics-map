"use client";

import { useId, useMemo, useState } from "react";
import type { ChamberSeatTrend } from "@/lib/partySeatTrendStats";

/**
 * 【政党別・過去選挙の議席推移グラフ】
 * 素のSVGで組んだ積み上げ棒グラフ（stacked bar chart）。
 *
 * フォーム選定: 選挙は連続量ではなく離散的なイベント（実施間隔も不均一）なので、
 * BillSessionTrendChart（積み上げ面グラフ）とは異なり積み上げ棒を採用した
 * （面グラフは「選挙と選挙の間を補間できる連続値」であるかのように誤読されうる）。
 *
 * 配色: 政党の識別色は data/parties.json の公式カラーをそのまま使用する
 * （PartyColorDot・SemicircleSeatChart・PartyCompositionSummary と同じ方針。
 * 新規に配色を考案していないため dataviz skill の validate_palette.js による
 * 検証対象外）。data/parties.json のidに解決できなかった政党（解散・改称等）は
 * 個別に色を割り当てず、ニュートラルグレーの「その他」1系列にまとめる
 * （src/lib/partySeatTrendStats.ts 参照）。積み上げ順・凡例順は議席数の多い順
 * （SemicircleSeatChart と同じ「降順のみ」の方針、評価的な意味は持たせない）。
 */

interface PartySeatTrendChartProps {
  trend: ChamberSeatTrend;
}

const MARGIN = { top: 16, right: 12, bottom: 34, left: 44 };
const VIEW_W = 1000;
const VIEW_H = 340;
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;
const BAR_WIDTH_RATIO = 0.56;

function niceMax(rawMax: number): number {
  if (rawMax <= 0) return 10;
  const candidates = [50, 100, 120, 150, 200, 250, 300, 400, 480, 500, 600];
  return candidates.find((c) => c >= rawMax) ?? Math.ceil(rawMax / 100) * 100;
}

export function PartySeatTrendChart({ trend }: PartySeatTrendChartProps) {
  const titleId = useId();
  const descId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { elections, legend, chamber } = trend;
  const n = elections.length;

  const layout = useMemo(() => {
    const yMax = niceMax(Math.max(...elections.map((e) => e.totalSeats)));
    const slot = PLOT_W / n;
    const barWidth = slot * BAR_WIDTH_RATIO;

    const xCenters = elections.map((_, i) => MARGIN.left + slot * (i + 0.5));
    const yAt = (value: number) => MARGIN.top + PLOT_H - (value / yMax) * PLOT_H;

    const bars = elections.map((e, i) => {
      const xCenter = xCenters[i]!;
      const x = xCenter - barWidth / 2;
      let cumulative = 0;
      const rects = e.segments.map((seg) => {
        const yTop = yAt(cumulative + seg.seats);
        const yBottom = yAt(cumulative);
        cumulative += seg.seats;
        return { ...seg, x, y: yTop, width: barWidth, height: yBottom - yTop };
      });
      // 帯同士の境目（surface色2pxのすき間の代替として区切り線を引く）
      const separatorYs = rects.slice(1).map((r) => r.y);
      return { x, xCenter, rects, separatorYs, election: e };
    });

    const yTickCount = 4;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) =>
      Math.round((yMax / yTickCount) * i)
    );

    return { yMax, bars, yTicks, yAt };
  }, [elections, n]);

  const { bars, yTicks, yAt } = layout;

  const active = activeIndex !== null ? bars[activeIndex] : null;
  const activeLeftPct = active ? (active.xCenter / VIEW_W) * 100 : null;
  const tooltipAlign =
    activeLeftPct === null
      ? "center"
      : activeLeftPct < 15
        ? "start"
        : activeLeftPct > 85
          ? "end"
          : "center";

  return (
    <section
      aria-labelledby={titleId}
      className="party-seat-trend-chart rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900 sm:p-6"
    >
      <style>{`
        .party-seat-trend-chart {
          --chart-surface: #ffffff;
          --chart-ink: #171717;
          --chart-ink-secondary: #525252;
          --chart-grid: #e5e5e5;
          --chart-axis: #d4d4d4;
        }
        @media (prefers-color-scheme: dark) {
          .party-seat-trend-chart {
            --chart-surface: #171717;
            --chart-ink: #fafafa;
            --chart-ink-secondary: #a3a3a3;
            --chart-grid: #262626;
            --chart-axis: #404040;
          }
        }
        .party-seat-trend-chart .hit-rect { fill: transparent; cursor: pointer; }
        .party-seat-trend-chart .hit-rect:focus-visible {
          outline: none;
          stroke: var(--chart-ink);
          stroke-width: 2;
        }
      `}</style>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id={titleId}
          className="text-base font-semibold text-neutral-900 dark:text-neutral-50"
        >
          {chamber} 政党別議席数の推移
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {elections[0]!.electionYear}年〜{elections[n - 1]!.electionYear}年（直近{n}回）
        </p>
      </div>
      <p id={descId} className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        選挙ごとの政党別獲得議席数を積み上げ棒で表示しています。バーにポインタを合わせる、またはTabキーでfocusすると内訳を確認できます。現在の政党マスタに対応がつかない解散・改称済みの政党は「{legend[legend.length - 1]?.label}」にまとめています。
      </p>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden="true">
        {legend.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-inset ring-black/10 dark:ring-white/10"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </li>
        ))}
      </ul>

      <div className="relative mt-3">
        {active && (
          <div
            className="pointer-events-none absolute top-1 z-10 w-max max-w-[calc(100%-8px)] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-card-hover dark:border-neutral-700 dark:bg-neutral-800"
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
              {active.election.electionName}（{active.election.electionYear}年）
            </p>
            <dl className="mt-1 max-h-48 space-y-0.5 overflow-auto">
              {active.rects.map((seg) => (
                <div key={seg.key} className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: seg.color }}
                    />
                    {seg.label}
                  </dt>
                  <dd className="font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
                    {seg.seats.toLocaleString("ja-JP")}
                  </dd>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-neutral-200 pt-1 dark:border-neutral-700">
                <dt className="text-neutral-600 dark:text-neutral-300">計</dt>
                <dd className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {active.election.totalSeats.toLocaleString("ja-JP")}
                </dd>
              </div>
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
          {yTicks.map((tick) => (
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

          {bars.map((bar, i) => (
            <g key={i}>
              {bar.rects.map((r) => (
                <rect
                  key={r.key}
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={Math.max(r.height, 0)}
                  fill={r.color}
                  rx={1.5}
                />
              ))}
              {bar.separatorYs.map((y, si) => (
                <line
                  key={si}
                  x1={bar.x}
                  x2={bar.x + BAR_WIDTH_RATIO * (PLOT_W / n)}
                  y1={y}
                  y2={y}
                  stroke="var(--chart-surface)"
                  strokeWidth={2}
                />
              ))}
            </g>
          ))}

          <line
            x1={MARGIN.left}
            x2={MARGIN.left + PLOT_W}
            y1={MARGIN.top + PLOT_H}
            y2={MARGIN.top + PLOT_H}
            stroke="var(--chart-axis)"
            strokeWidth={1}
          />

          {yTicks.map((tick) => (
            <text
              key={tick}
              x={MARGIN.left - 8}
              y={yAt(tick) + 3}
              textAnchor="end"
              fontSize={11}
              fill="var(--chart-ink-secondary)"
            >
              {tick.toLocaleString("ja-JP")}
            </text>
          ))}

          {bars.map((bar, i) => (
            <text
              key={i}
              x={bar.xCenter}
              y={MARGIN.top + PLOT_H + 20}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize={11}
              fill="var(--chart-ink-secondary)"
            >
              {bar.election.electionYear}
            </text>
          ))}

          {bars.map((bar, i) => (
            <rect
              key={i}
              className="hit-rect"
              x={MARGIN.left + (PLOT_W / n) * i}
              y={MARGIN.top}
              width={PLOT_W / n}
              height={PLOT_H}
              tabIndex={0}
              role="button"
              aria-label={`${bar.election.electionName}（${bar.election.electionYear}年）：${bar.rects
                .map((r) => `${r.label}${r.seats}議席`)
                .join("、")}、計${bar.election.totalSeats}議席`}
              onPointerEnter={() => setActiveIndex(i)}
              onPointerLeave={() =>
                setActiveIndex((cur) => (cur === i ? null : cur))
              }
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex((cur) => (cur === i ? null : cur))}
            />
          ))}
        </svg>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          データを表で見る（選挙ごとの政党別獲得議席数、原資料の表記のまま）
        </summary>
        <div className="mt-2 space-y-4">
          {elections.map((e) => (
            <div key={e.electionYear}>
              <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                {e.electionName}（{e.electionYear}年、計{e.totalSeats}議席）
                <a
                  href={e.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-accent-600 hover:underline dark:text-accent-400"
                >
                  出典
                </a>
              </p>
              <div className="mt-1 max-h-56 overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                <table className="w-full min-w-[320px] border-collapse text-xs">
                  <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-neutral-600 dark:text-neutral-300">
                        政党
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium text-neutral-600 dark:text-neutral-300">
                        議席数
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.rawResults
                      .slice()
                      .sort((a, b) => b.seats - a.seats)
                      .map((r) => (
                        <tr
                          key={r.partyName}
                          className="border-t border-neutral-100 dark:border-neutral-800"
                        >
                          <td className="px-3 py-1 text-neutral-700 dark:text-neutral-300">
                            {r.partyName}
                          </td>
                          <td className="px-3 py-1 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                            {r.seats.toLocaleString("ja-JP")}
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
