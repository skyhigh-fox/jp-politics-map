"use client";

import { useId, useMemo, useState } from "react";
import type { BillStatus } from "@/types";
import {
  SESSION_STATUS_ORDER,
  type SessionStatusCounts,
} from "@/lib/billSessionStats";

/**
 * 【国会回次別・法案成立状況の推移グラフ】
 * 素のSVGで組んだ積み上げ面グラフ（stacked area chart）。dataviz スキルの
 * 手順（フォーム選定→配色→検証→マーク仕様→ホバー層→アクセシビリティ）に
 * 従って実装している。詳細な配色の検証根拠はObsidian:
 * jp-politics-map/決定事項ログ.md を参照。
 *
 * 配色方針:
 * - 新しい配色を自前で考案せず、既存の StatusBadge コンポーネント
 *   （src/components/StatusBadge.tsx）の思想を踏襲する。
 *   「良い/悪い」ではなく「進行段階」を示す中立配色。
 *   審議中=sky（進行中）、継続審議=amber（保留）、
 *   可決/成立=emerald 2段階（緑が濃いほど完了に近い＝可決<成立）、
 *   否決/廃案=neutral（グレー）2段階（終了、審議未了か明示的否決かの違い）。
 * - dataviz skill の validate_palette.js で検証済み（--mode light/dark）。
 *   審議中・継続審議・可決・成立・否決・廃案の隣接する色同士は
 *   CVD分離（ΔE）・通常視力分離ともに基準をクリア。
 *   例外として、同一色相内の2段階（可決/成立、否決/廃案）は
 *   「進行の度合い」を表す順序尺度（ordinal）として
 *   --ordinal 検証（単色・明度単調減少・ΔL>=0.06）で別途パスしている
 *   （カテゴリカルの隣接ΔE>=15基準はそのままでは満たせないが、
 *   積み上げ位置・凡例・ツールチップ・データ表という secondary encoding で
 *   識別を補っているため許容）。
 *   neutral（否決/廃案）はChroma floorチェックには通らない
 *   （意図的に無彩色＝「審議終了」を表すグレー。StatusBadgeの既存方針を継承）。
 *   contrastチェックのWARN（emerald-500系・neutral-400系が3:1未満）は
 *   凡例・直接ツールチップ・データ表という relief channel で緩和している。
 */

interface BillSessionTrendChartProps {
  data: SessionStatusCounts[];
}

const STATUS_META: Record<
  BillStatus,
  { slug: string; light: string; dark: string; label: string }
> = {
  審議中: { slug: "in-progress", light: "#0284c7", dark: "#0284c7", label: "審議中" },
  継続審議: { slug: "carryover", light: "#d97706", dark: "#d97706", label: "継続審議" },
  可決: { slug: "passed", light: "#10b981", dark: "#34d399", label: "可決" },
  成立: { slug: "enacted", light: "#047857", dark: "#059669", label: "成立" },
  否決: { slug: "rejected", light: "#a3a3a3", dark: "#d4d4d4", label: "否決" },
  廃案: { slug: "lapsed", light: "#525252", dark: "#737373", label: "廃案" },
};

// 凡例・積み上げ順（下→上）と同じ並びで表示する
const LEGEND_ORDER = SESSION_STATUS_ORDER;

const MARGIN = { top: 16, right: 12, bottom: 30, left: 44 };
const VIEW_W = 1000;
const VIEW_H = 340;
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;
const MAX_X_TICKS = 10;

/** グラフのY軸上限を「きりの良い数」に丸める */
function niceMax(rawMax: number): number {
  if (rawMax <= 0) return 10;
  const candidates = [
    10, 20, 25, 40, 50, 80, 100, 120, 160, 200, 250, 300, 400, 500, 600, 800,
    1000, 1200, 1600, 2000, 2500, 3000,
  ];
  const found = candidates.find((c) => c >= rawMax);
  return found ?? Math.ceil(rawMax / 500) * 500;
}

function pathFromPoints(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

export function BillSessionTrendChart({ data }: BillSessionTrendChartProps) {
  const titleId = useId();
  const descId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const n = data.length;

  const layout = useMemo(() => {
    if (n < 2) return null;

    const rawMax = Math.max(...data.map((d) => d.total));
    const yMax = niceMax(rawMax);

    const xAt = (i: number) => MARGIN.left + (i / (n - 1)) * PLOT_W;
    const yAt = (value: number) =>
      MARGIN.top + PLOT_H - (value / yMax) * PLOT_H;

    const xPositions = data.map((_, i) => xAt(i));

    // 各回次ごとの累積値（積み上げ順）
    const cumulative = data.map((d) => {
      let running = 0;
      return LEGEND_ORDER.map((status) => (running += d.counts[status]));
    });

    const bands = LEGEND_ORDER.map((status, k) => {
      const topPoints = data.map((_, i) => ({
        x: xPositions[i]!,
        y: yAt(cumulative[i]![k]!),
      }));
      const bottomPoints = data.map((_, i) => ({
        x: xPositions[i]!,
        y: yAt(k === 0 ? 0 : cumulative[i]![k - 1]!),
      }));
      const bottomEdge = pathFromPoints([...bottomPoints].reverse()).replace(
        /^M/,
        "L"
      );
      const path = `${pathFromPoints(topPoints)} ${bottomEdge} Z`;
      return { status, topPoints, path };
    });

    // 隣接する帯の境目に引く区切り線（surface色、2px）＝「2pxのすき間」の代替表現
    const separators = bands.slice(0, -1).map((b) => b.topPoints);

    // 当たり判定（各点の中間で分割、キーボード操作・ホバー両対応）
    const hitRects = xPositions.map((x, i) => {
      const prevMid = i === 0 ? MARGIN.left : (xPositions[i - 1]! + x) / 2;
      const nextMid =
        i === n - 1 ? MARGIN.left + PLOT_W : (x + xPositions[i + 1]!) / 2;
      return { x: prevMid, width: nextMid - prevMid };
    });

    // X軸ラベルは間引く（69回次全部出すと詰まるため）
    const tickStep = Math.max(1, Math.ceil((n - 1) / (MAX_X_TICKS - 1)));
    const tickIndices = new Set<number>();
    for (let i = 0; i < n; i += tickStep) tickIndices.add(i);
    tickIndices.add(n - 1);

    const yTickCount = 4;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) =>
      Math.round((yMax / yTickCount) * i)
    );

    return {
      yMax,
      xPositions,
      bands,
      separators,
      hitRects,
      tickIndices,
      yTicks,
      yAt,
    };
  }, [data, n]);

  if (n === 0) return null;

  if (!layout) {
    return (
      <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
        推移グラフを表示するには2回次以上のデータが必要です。
      </p>
    );
  }

  const { xPositions, bands, separators, hitRects, tickIndices, yTicks, yAt } =
    layout;

  const active = activeIndex !== null ? data[activeIndex]! : null;
  const activeX = activeIndex !== null ? xPositions[activeIndex]! : null;
  const activeLeftPct = activeX !== null ? (activeX / VIEW_W) * 100 : null;
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
      className="bill-trend-chart mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900 sm:p-6"
    >
      <style>{`
        .bill-trend-chart {
          --chart-surface: #ffffff;
          --chart-ink: #171717;
          --chart-ink-secondary: #525252;
          --chart-grid: #e5e5e5;
          --chart-axis: #d4d4d4;
          ${LEGEND_ORDER.map(
            (s) => `--status-${STATUS_META[s].slug}: ${STATUS_META[s].light};`
          ).join("\n          ")}
        }
        @media (prefers-color-scheme: dark) {
          .bill-trend-chart {
            --chart-surface: #171717;
            --chart-ink: #fafafa;
            --chart-ink-secondary: #a3a3a3;
            --chart-grid: #262626;
            --chart-axis: #404040;
            ${LEGEND_ORDER.map(
              (s) => `--status-${STATUS_META[s].slug}: ${STATUS_META[s].dark};`
            ).join("\n            ")}
          }
        }
        .bill-trend-chart .hit-rect { fill: transparent; cursor: pointer; }
        .bill-trend-chart .hit-rect:focus-visible {
          outline: none;
          stroke: var(--chart-ink);
          stroke-width: 2;
          fill: var(--chart-grid);
          fill-opacity: 0.5;
        }
      `}</style>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id={titleId}
          className="text-base font-semibold text-neutral-900 dark:text-neutral-50"
        >
          国会回次別 法案審議状況の推移
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          第{data[0]!.session}回〜第{data[n - 1]!.session}回国会（
          {n}回次・全{data.reduce((s, d) => s + d.total, 0).toLocaleString("ja-JP")}件）
        </p>
      </div>
      <p id={descId} className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        各回次に提出された法案の件数を審議状況ごとに積み上げて表示しています。グラフ上にポインタを合わせる、またはTabキーで focus
        すると回次ごとの内訳を確認できます。
      </p>

      {/* 凡例（2系列以上のため常設。色だけに依存しないようラベルを併記） */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden="true">
        {LEGEND_ORDER.map((status) => (
          <li key={status} className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `var(--status-${STATUS_META[status].slug})` }}
            />
            {STATUS_META[status].label}
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
              第{active.session}回国会
            </p>
            <dl className="mt-1 space-y-0.5">
              {LEGEND_ORDER.map((status) => (
                <div key={status} className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: `var(--status-${STATUS_META[status].slug})` }}
                    />
                    {STATUS_META[status].label}
                  </dt>
                  <dd className="font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
                    {active.counts[status].toLocaleString("ja-JP")}件
                  </dd>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-neutral-200 pt-1 dark:border-neutral-700">
                <dt className="text-neutral-600 dark:text-neutral-300">計</dt>
                <dd className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {active.total.toLocaleString("ja-JP")}件
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
          {/* 横方向グリッド線（recessive: 目立たせない） */}
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

          {/* 積み上げ面 */}
          {bands.map(({ status, path }) => (
            <path
              key={status}
              d={path}
              fill={`var(--status-${STATUS_META[status].slug})`}
            />
          ))}

          {/* 帯の境目に引く区切り線（surface色、隣接する帯を分離する） */}
          {separators.map((points, i) => (
            <polyline
              key={i}
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--chart-surface)"
              strokeWidth={2}
            />
          ))}

          {/* 基準線（X軸） */}
          <line
            x1={MARGIN.left}
            x2={MARGIN.left + PLOT_W}
            y1={MARGIN.top + PLOT_H}
            y2={MARGIN.top + PLOT_H}
            stroke="var(--chart-axis)"
            strokeWidth={1}
          />

          {/* Y軸ラベル */}
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

          {/* X軸ラベル（間引き済み） */}
          {[...tickIndices].map((i) => (
            <text
              key={i}
              x={xPositions[i]!}
              y={MARGIN.top + PLOT_H + 18}
              textAnchor="middle"
              fontSize={11}
              fill="var(--chart-ink-secondary)"
            >
              第{data[i]!.session}回
            </text>
          ))}

          {/* クロスヘア（ホバー/フォーカス中の回次を示す） */}
          {activeIndex !== null && (
            <line
              x1={xPositions[activeIndex]!}
              x2={xPositions[activeIndex]!}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_H}
              stroke="var(--chart-ink)"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          )}

          {/* 当たり判定＋キーボードフォーカス対象（各回次1つ、値はaria-labelで読み上げ） */}
          {hitRects.map((rect, i) => (
            <rect
              key={i}
              className="hit-rect"
              x={rect.x}
              y={MARGIN.top}
              width={rect.width}
              height={PLOT_H}
              tabIndex={0}
              role="button"
              aria-label={`第${data[i]!.session}回国会：${LEGEND_ORDER.map(
                (s) => `${STATUS_META[s].label}${data[i]!.counts[s]}件`
              ).join("、")}、計${data[i]!.total}件`}
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

      {/* データテーブル代替（スクリーンリーダー・数値確認用） */}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          データを表で見る（回次別・審議状況別の法案数）
        </summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium text-neutral-600 dark:text-neutral-300">
                  国会回次
                </th>
                {LEGEND_ORDER.map((status) => (
                  <th
                    key={status}
                    className="px-3 py-1.5 text-right font-medium text-neutral-600 dark:text-neutral-300"
                  >
                    {STATUS_META[status].label}
                  </th>
                ))}
                <th className="px-3 py-1.5 text-right font-medium text-neutral-600 dark:text-neutral-300">
                  計
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.session}
                  className="border-t border-neutral-100 dark:border-neutral-800"
                >
                  <td className="px-3 py-1 text-neutral-700 dark:text-neutral-300">
                    第{row.session}回
                  </td>
                  {LEGEND_ORDER.map((status) => (
                    <td
                      key={status}
                      className="px-3 py-1 text-right tabular-nums text-neutral-700 dark:text-neutral-300"
                    >
                      {row.counts[status].toLocaleString("ja-JP")}
                    </td>
                  ))}
                  <td className="px-3 py-1 text-right font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                    {row.total.toLocaleString("ja-JP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
