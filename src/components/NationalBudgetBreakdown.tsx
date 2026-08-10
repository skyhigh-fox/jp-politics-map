import { Fragment } from "react";
import { DataInsight } from "@/components/DataInsight";
import { formatYenCompact } from "@/lib/formatFinance";
import type { BudgetBreakdown, CategoryTrend } from "@/lib/nationalBudgetStats";

/**
 * 【国の歳出決算の内訳（区分別バーリスト＋区分ごとの年度推移）】
 *
 * フォーム選定の理由:
 * 主要経費別（37区分）・目的別（16区分）は、dataviz skill のカテゴリカル配色
 * スロット数（8）を大きく超える。9色目を新しく作ることも、財務省の公式区分を
 * 独自に「その他」へ再集約することも本プロジェクトの方針で禁じているため、
 * 積み上げグラフではなく
 *   (1) 最新年度の内訳を単色（accent）の横棒リストで示す
 *   (2) 区分ごとに独立した小さな推移グラフ（スモールマルチプル）を並べる
 * という組み合わせで表現する。単年度の絶対額だけを見せないという方針
 * （年度推移の併置）も (2) で満たしている。
 *
 * 色は分野の識別子であって優劣ではないため、区分ごとに色を変えず
 * 単一のアクセントカラーで統一する（PrefectureExpenditureBreakdown と同じ考え方）。
 * 並び順は財務省の掲載順で固定し、金額順ソートはしない。
 */

const SPARK_W = 240;
const SPARK_H = 56;
const SPARK_PAD = 2;

function Sparkbars({ trend }: { trend: CategoryTrend }) {
  const { points, maxAmountThousandYen } = trend;
  if (points.length === 0 || maxAmountThousandYen <= 0) return null;
  const slot = SPARK_W / points.length;
  const barWidth = Math.max(slot * 0.72, 0.8);

  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="mt-2 w-full"
      role="img"
      aria-label={`${trend.name}の年度推移（${points[0]!.eraLabel}〜${points.at(-1)!.eraLabel}、最大${formatYenCompact(maxAmountThousandYen)}）`}
    >
      {/* ゼロ基点厳守: 高さは 0 → maxAmount を SPARK_H に線形対応させる */}
      {points.map((p, i) => {
        const h = Math.max(
          ((p.amountThousandYen / maxAmountThousandYen) * (SPARK_H - SPARK_PAD)),
          p.amountThousandYen > 0 ? 0.6 : 0
        );
        return (
          <rect
            key={p.fiscalYear}
            x={slot * i + (slot - barWidth) / 2}
            y={SPARK_H - h}
            width={barWidth}
            height={h}
            className="fill-accent-500 dark:fill-accent-400"
          >
            <title>{`${p.eraLabel}: ${formatYenCompact(p.amountThousandYen)}`}</title>
          </rect>
        );
      })}
      <line
        x1={0}
        x2={SPARK_W}
        y1={SPARK_H}
        y2={SPARK_H}
        className="stroke-neutral-300 dark:stroke-neutral-700"
        strokeWidth={1}
      />
    </svg>
  );
}

export function NationalBudgetBreakdown({
  heading,
  description,
  facts,
  breakdown,
  trends,
  source,
  footnote,
}: {
  heading: string;
  description: string;
  facts: string[];
  breakdown: BudgetBreakdown;
  trends: CategoryTrend[];
  source: { title: string; url: string; pageUrl: string };
  footnote?: React.ReactNode;
}) {
  const values = breakdown.items
    .map((i) => i.amountThousandYen)
    .filter((v): v is number => v !== null);
  const max = values.length > 0 ? Math.max(...values) : 0;
  const shown = breakdown.items.filter((i) => i.amountThousandYen !== null);
  const notApplicable = breakdown.items.filter((i) => i.amountThousandYen === null);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {heading}
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {breakdown.eraLabel}
          {breakdown.totalThousandYen !== null &&
            `　合計 ${formatYenCompact(breakdown.totalThousandYen)}`}
        </p>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {description}
      </p>

      <DataInsight facts={facts} />

      <h3 className="mt-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {breakdown.eraLabel}の内訳
      </h3>
      <ul className="mt-2 space-y-1.5">
        {shown.map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-xs">
            <span
              className="w-32 shrink-0 truncate text-neutral-600 dark:text-neutral-400 sm:w-44"
              title={item.name}
            >
              {item.name}
            </span>
            <span className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <span
                className="block h-full rounded-full bg-accent-500 dark:bg-accent-400"
                style={{
                  width: `${max > 0 ? ((item.amountThousandYen ?? 0) / max) * 100 : 0}%`,
                }}
              />
            </span>
            <span className="w-20 shrink-0 text-right tabular-nums text-neutral-700 dark:text-neutral-300 sm:w-24">
              {formatYenCompact(item.amountThousandYen ?? 0)}
            </span>
            <span className="hidden w-12 shrink-0 text-right tabular-nums text-neutral-400 dark:text-neutral-500 sm:inline">
              {item.sharePercent !== null ? `${item.sharePercent.toFixed(1)}%` : "―"}
            </span>
          </li>
        ))}
      </ul>
      {notApplicable.length > 0 && (
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-600">
          {breakdown.eraLabel}に金額の計上がない区分（原資料で「−」表記）:{" "}
          {notApplicable.map((i) => i.name).join("、")}
        </p>
      )}

      {trends.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            区分ごとの年度推移
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            区分ごとに縦軸の目盛りが異なります（各グラフの高さは、その区分の期間内最大額を上端としたゼロ基点の棒グラフです）。区分同士の高さは比較できません。
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trends.map((trend) => (
              <li
                key={trend.name}
                className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <p
                  className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-300"
                  title={trend.name}
                >
                  {trend.name}
                </p>
                <p className="text-xs tabular-nums text-neutral-500 dark:text-neutral-500">
                  {trend.points.at(-1)?.eraLabel}{" "}
                  {formatYenCompact(trend.points.at(-1)?.amountThousandYen ?? 0)}
                </p>
                <Sparkbars trend={trend} />
                <p className="mt-1 flex justify-between text-[10px] tabular-nums text-neutral-400 dark:text-neutral-600">
                  <span>{trend.points[0]?.fiscalYear}</span>
                  <span>最大 {formatYenCompact(trend.maxAmountThousandYen)}</span>
                  <span>{trend.points.at(-1)?.fiscalYear}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          {breakdown.eraLabel}の内訳を表で見る（細目まで、財務省の分類・掲載順のまま）
        </summary>
        <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[360px] border-collapse text-xs">
            <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium text-neutral-600 dark:text-neutral-300">
                  区分
                </th>
                <th className="px-3 py-1.5 text-right font-medium text-neutral-600 dark:text-neutral-300">
                  金額
                </th>
              </tr>
            </thead>
            <tbody>
              {breakdown.items.map((item) => (
                <Fragment key={item.name}>
                  <tr className="border-t border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <td className="px-3 py-1 font-medium text-neutral-800 dark:text-neutral-200">
                      {item.name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1 text-right font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
                      {item.amountThousandYen !== null
                        ? formatYenCompact(item.amountThousandYen)
                        : "―"}
                    </td>
                  </tr>
                  {item.subItems.map((sub) => (
                    <tr
                      key={`${item.name}-${sub.name}`}
                      className="border-t border-neutral-100 dark:border-neutral-800"
                    >
                      <td className="py-1 pl-7 pr-3 text-neutral-600 dark:text-neutral-400">
                        {sub.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                        {sub.amountThousandYen !== null
                          ? formatYenCompact(sub.amountThousandYen)
                          : "―"}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {footnote && (
        <div className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          {footnote}
        </div>
      )}

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
