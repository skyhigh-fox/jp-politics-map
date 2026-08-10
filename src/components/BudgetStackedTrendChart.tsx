"use client";

import { useId, useMemo, useState } from "react";
import { DataInsight } from "@/components/DataInsight";
import { formatYenCompact } from "@/lib/formatFinance";
import type { StackedTrend } from "@/lib/nationalBudgetStats";

/**
 * 【国の税収・歳入の年度推移グラフ】
 * 素のSVGで組んだ積み上げ棒グラフ（stacked bar chart）。
 *
 * フォーム選定: 年度は等間隔の離散イベント（毎年度必ず1回）なので棒で表す。
 * 面グラフにすると年度間を補間できる連続値のように誤読されうるため使わない。
 * ゼロ基点は厳守（y軸は必ず0から）。
 *
 * 配色: `src/lib/budgetChartColors.ts` の8スロットのカテゴリカル配色を
 * 財務省原資料の掲載順に割り当てる（金額の大小で色を付け替えない）。
 * light/darkの値はCSS変数（`--budget-series-N`）で切り替える
 * （SVGの`fill`属性はTailwindの`dark:`が効かないため。BillSessionTrendChart と
 * 同じ手法）。light側は一部スロットがサーフェスとの3:1コントラストを満たさない
 * WARN状態だが、dataviz skillが求める relief channel（ラベル併記の凡例・
 * 直接ツールチップ・`<details>`のデータ表）をすべて備えることで緩和している。
 *
 * 【中立性】
 * - 区分の並び順・凡例順は財務省の掲載順に固定（金額順ソートなし）。
 * - 公債金も他の歳入科目と同じ扱い・同じ配色で1つの帯として表示する。
 *   いわゆる「ワニの口」（税収と歳出の乖離の強調）表現は作らない。
 * - 決算が確定していない年度（予算額）は帯を斜線ハッチで区別し、
 *   注記でその旨を明示する（決算額と同じ見た目で並べない）。
 */

interface BudgetStackedTrendChartProps {
  trend: StackedTrend;
  /** 見出し（例:"税収の推移（税目別）"） */
  heading: string;
  /** グラフの説明文 */
  description: string;
  /** DataInsight に出す事実文 */
  facts: string[];
  /** 出典表記 */
  source: { title: string; url: string; pageUrl: string };
  /** 決算未確定年度についての注記（該当年度がある場合のみ表示） */
  provisionalNote?: string;
}

const MARGIN = { top: 16, right: 12, bottom: 34, left: 52 };
const VIEW_W = 1000;
const VIEW_H = 340;
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;
const BAR_WIDTH_RATIO = 0.66;

/** 千円単位の値に対して「切りのよい」y軸上限（兆円刻み）を返す */
function niceMax(rawMax: number): number {
  if (rawMax <= 0) return 1;
  const trillion = 1e9; // 1兆円 = 1,000,000,000 千円
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 150, 200, 250, 300];
  const found = steps.find((s) => s * trillion >= rawMax);
  return (found ?? Math.ceil(rawMax / (100 * trillion)) * 100) * trillion;
}

export function BudgetStackedTrendChart({
  trend,
  heading,
  description,
  facts,
  source,
  provisionalNote,
}: BudgetStackedTrendChartProps) {
  const titleId = useId();
  const descId = useId();
  const hatchId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { years, legend } = trend;
  const n = years.length;

  const layout = useMemo(() => {
    const yMax = niceMax(trend.maxStackedTotal);
    const slot = PLOT_W / n;
    const barWidth = Math.max(slot * BAR_WIDTH_RATIO, 1);
    const yAt = (value: number) => MARGIN.top + PLOT_H - (value / yMax) * PLOT_H;

    const bars = years.map((year, i) => {
      const xCenter = MARGIN.left + slot * (i + 0.5);
      const x = xCenter - barWidth / 2;
      let cumulative = 0;
      const rects = year.segments.map((seg) => {
        const yTop = yAt(cumulative + seg.amountThousandYen);
        const yBottom = yAt(cumulative);
        cumulative += seg.amountThousandYen;
        return { ...seg, x, y: yTop, width: barWidth, height: Math.max(yBottom - yTop, 0) };
      });
      // 帯同士の境目（surface色の区切り線でセグメントを分離する）
      const separatorYs = rects.slice(1).map((r) => r.y);
      return { x, xCenter, barWidth, rects, separatorYs, year };
    });

    const yTicks = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i);
    return { yMax, bars, yTicks, yAt };
  }, [years, n, trend.maxStackedTotal]);

  const { bars, yTicks, yAt } = layout;

  // x軸ラベルは全年度分入りきらないので、最新年度を起点に5年度おきへ間引く。
  // 先頭年度は、直近のラベル付き年度と3スロット以上離れているときだけ足す
  // （距離が近いとラベル同士が重なって読めなくなるため。期間の両端は
  // 見出し右側の「〜年度〜〜年度」表記でも示している）
  const labelStride = 5;
  const labeledIndexes = new Set<number>();
  for (let i = n - 1; i >= 0; i -= labelStride) labeledIndexes.add(i);
  const leftMostLabeled = Math.min(...labeledIndexes);
  if (leftMostLabeled >= 3) labeledIndexes.add(0);

  const active = activeIndex !== null ? bars[activeIndex] : null;
  const activeLeftPct = active ? (active.xCenter / VIEW_W) * 100 : null;
  const tooltipAlign =
    activeLeftPct === null
      ? "center"
      : activeLeftPct < 18
        ? "start"
        : activeLeftPct > 82
          ? "end"
          : "center";

  const colorVars = legend
    .map((item, i) => `--budget-series-${i}: ${item.light};`)
    .join("\n          ");
  const darkColorVars = legend
    .map((item, i) => `--budget-series-${i}: ${item.dark};`)
    .join("\n            ");

  const hasProvisional = years.some((y) => !y.isSettlement);

  return (
    <section
      aria-labelledby={titleId}
      className="budget-stacked-trend rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900 sm:p-6"
    >
      <style>{`
        .budget-stacked-trend {
          --chart-surface: #ffffff;
          --chart-ink-secondary: #525252;
          --chart-grid: #e5e5e5;
          --chart-axis: #d4d4d4;
          ${colorVars}
        }
        @media (prefers-color-scheme: dark) {
          .budget-stacked-trend {
            --chart-surface: #171717;
            --chart-ink-secondary: #a3a3a3;
            --chart-grid: #262626;
            --chart-axis: #404040;
            ${darkColorVars}
          }
        }
        .budget-stacked-trend .hit-rect { fill: transparent; cursor: pointer; }
        .budget-stacked-trend .hit-rect:focus-visible {
          outline: none;
          stroke: var(--chart-ink-secondary);
          stroke-width: 2;
        }
      `}</style>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id={titleId}
          className="text-base font-semibold text-neutral-900 dark:text-neutral-50"
        >
          {heading}
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {years[0]?.eraLabel}〜{years[n - 1]?.eraLabel}（{n}年度分）
        </p>
      </div>
      <p id={descId} className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {description}
        {hasProvisional && provisionalNote ? `　${provisionalNote}` : ""}
      </p>

      <DataInsight facts={facts} />

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {legend.map((item, i) => (
          <li
            key={item.key}
            className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-inset ring-black/10 dark:ring-white/10"
              style={{ backgroundColor: `var(--budget-series-${i})` }}
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
              {active.year.eraLabel}（{active.year.fiscalYear}年度）
              {!active.year.isSettlement && (
                <span className="ml-1 font-normal text-neutral-500 dark:text-neutral-400">
                  ※決算未確定
                </span>
              )}
            </p>
            <dl className="mt-1 max-h-48 space-y-0.5 overflow-auto">
              {active.rects.map((seg) => (
                <div key={seg.key} className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: `var(--budget-series-${legend.findIndex((l) => l.key === seg.key)})`,
                      }}
                    />
                    {seg.label}
                  </dt>
                  <dd className="font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
                    {formatYenCompact(seg.amountThousandYen)}
                  </dd>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-neutral-200 pt-1 dark:border-neutral-700">
                <dt className="text-neutral-600 dark:text-neutral-300">計</dt>
                <dd className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {formatYenCompact(active.year.stackedTotalThousandYen)}
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
          <defs>
            {/* 決算未確定年度（予算額）の帯を斜線ハッチで区別する */}
            <pattern
              id={hatchId}
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width={6} height={6} fill="var(--chart-surface)" opacity={0.55} />
              <line x1={0} y1={0} x2={0} y2={6} stroke="var(--chart-surface)" strokeWidth={3} />
            </pattern>
          </defs>

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
            <g key={bar.year.fiscalYear}>
              {bar.rects.map((r) => (
                <rect
                  key={r.key}
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  fill={`var(--budget-series-${legend.findIndex((l) => l.key === r.key)})`}
                />
              ))}
              {!bar.year.isSettlement &&
                bar.rects.map((r) => (
                  <rect
                    key={`${r.key}-hatch`}
                    x={r.x}
                    y={r.y}
                    width={r.width}
                    height={r.height}
                    fill={`url(#${hatchId})`}
                  />
                ))}
              {bar.separatorYs.map((y, si) => (
                <line
                  key={si}
                  x1={bar.x}
                  x2={bar.x + bar.barWidth}
                  y1={y}
                  y2={y}
                  stroke="var(--chart-surface)"
                  strokeWidth={1.5}
                />
              ))}
              {activeIndex === i && (
                <rect
                  x={bar.x - 1}
                  y={yAt(bar.year.stackedTotalThousandYen) - 1}
                  width={bar.barWidth + 2}
                  height={MARGIN.top + PLOT_H - yAt(bar.year.stackedTotalThousandYen) + 2}
                  fill="none"
                  stroke="var(--chart-ink-secondary)"
                  strokeWidth={1.5}
                />
              )}
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
              {tick === 0 ? "0" : `${Math.round(tick / 1e9)}兆円`}
            </text>
          ))}

          {bars.map((bar, i) =>
            labeledIndexes.has(i) ? (
              <text
                key={bar.year.fiscalYear}
                x={bar.xCenter}
                y={MARGIN.top + PLOT_H + 20}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                fontSize={11}
                fill="var(--chart-ink-secondary)"
              >
                {bar.year.fiscalYear}
              </text>
            ) : null
          )}

          {bars.map((bar, i) => (
            <rect
              key={bar.year.fiscalYear}
              className="hit-rect"
              x={MARGIN.left + (PLOT_W / n) * i}
              y={MARGIN.top}
              width={PLOT_W / n}
              height={PLOT_H}
              tabIndex={0}
              role="button"
              aria-label={`${bar.year.eraLabel}：${bar.rects
                .map((r) => `${r.label}${formatYenCompact(r.amountThousandYen)}`)
                .join("、")}、計${formatYenCompact(bar.year.stackedTotalThousandYen)}${
                bar.year.isSettlement ? "" : "（決算未確定）"
              }`}
              onPointerEnter={() => setActiveIndex(i)}
              onPointerLeave={() => setActiveIndex((cur) => (cur === i ? null : cur))}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex((cur) => (cur === i ? null : cur))}
            />
          ))}
        </svg>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          データを表で見る（年度別・区分別の金額、財務省の分類・掲載順のまま）
        </summary>
        <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium text-neutral-600 dark:text-neutral-300">
                  年度
                </th>
                {legend.map((item) => (
                  <th
                    key={item.key}
                    className="px-3 py-1.5 text-right font-medium text-neutral-600 dark:text-neutral-300"
                  >
                    {item.label}
                  </th>
                ))}
                <th className="px-3 py-1.5 text-right font-medium text-neutral-600 dark:text-neutral-300">
                  計
                </th>
              </tr>
            </thead>
            <tbody>
              {[...years].reverse().map((year) => (
                <tr
                  key={year.fiscalYear}
                  className="border-t border-neutral-100 dark:border-neutral-800"
                >
                  <td className="whitespace-nowrap px-3 py-1 text-neutral-700 dark:text-neutral-300">
                    {year.eraLabel}
                    {!year.isSettlement && (
                      <span className="ml-1 text-neutral-400 dark:text-neutral-500">※</span>
                    )}
                  </td>
                  {legend.map((item) => {
                    const seg = year.segments.find((s) => s.key === item.key);
                    return (
                      <td
                        key={item.key}
                        className="whitespace-nowrap px-3 py-1 text-right tabular-nums text-neutral-700 dark:text-neutral-300"
                      >
                        {seg ? formatYenCompact(seg.amountThousandYen) : "―"}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-3 py-1 text-right font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                    {formatYenCompact(year.stackedTotalThousandYen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-600">
        出典:{" "}
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="text-accent-600 hover:underline dark:text-accent-400"
        >
          {source.title}
        </a>
        （
        <a
          href={source.pageUrl}
          target="_blank"
          rel="noreferrer"
          className="text-accent-600 hover:underline dark:text-accent-400"
        >
          掲載ページ
        </a>
        ）
      </p>
    </section>
  );
}
